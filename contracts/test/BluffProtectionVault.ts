import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

const usd = (n: number) => ethers.parseUnits(n.toString(), 6);
const id = (s: string) => ethers.id(s);

describe("BluffProtectionVault", () => {
  async function deploy() {
    const [owner, operator, oracle, fan, fan2, stranger] = await ethers.getSigners();
    const usdc = await (await ethers.getContractFactory("MockUSDC")).deploy();
    const vault = await (await ethers.getContractFactory("BluffProtectionVault")).deploy(
      await usdc.getAddress(),
      operator.address,
      oracle.address,
    );
    await usdc.mint(operator.address, usd(10_000));
    await usdc.connect(operator).approve(await vault.getAddress(), ethers.MaxUint256);
    const market = id("GEMI-NBA-2611230130-BOS-GSW-S-BOS9");
    const expiry = BigInt(Math.floor(Date.now() / 1000) + 86400);
    return { owner, operator, oracle, fan, fan2, stranger, usdc, vault, market, expiry };
  }

  async function withPolicy() {
    const f = await deploy();
    await f.vault
      .connect(f.operator)
      .purchasePolicy(id("p1"), f.fan.address, usd(6), usd(75), f.market, "Warriors lose by 10+", f.expiry);
    return f;
  }

  describe("purchasePolicy", () => {
    it("records the policy, pulls premium and tracks liability", async () => {
      const { vault, operator, fan, market, expiry, usdc } = await loadFixture(deploy);
      await expect(
        vault.connect(operator).purchasePolicy(id("p1"), fan.address, usd(6), usd(75), market, "Warriors lose by 10+", expiry),
      )
        .to.emit(vault, "PolicyPurchased")
        .withArgs(id("p1"), fan.address, market, usd(6), usd(75), expiry, "Warriors lose by 10+");

      const p = await vault.getPolicy(id("p1"));
      expect(p.holder).to.equal(fan.address);
      expect(p.payout).to.equal(usd(75));
      expect(p.status).to.equal(1n); // Active
      expect(await vault.totalLiability()).to.equal(usd(75));
      expect(await vault.reserves()).to.equal(usd(6));
      expect(await usdc.balanceOf(await vault.getAddress())).to.equal(usd(6));
      expect(await vault.policyCount()).to.equal(1n);
    });

    it("rejects duplicate policy ids", async () => {
      const { vault, operator, fan, market, expiry } = await loadFixture(withPolicy);
      await expect(
        vault.connect(operator).purchasePolicy(id("p1"), fan.address, usd(6), usd(75), market, "dup", expiry),
      ).to.be.revertedWithCustomError(vault, "DuplicatePolicy");
    });

    it("rejects zero payout and zero holder", async () => {
      const { vault, operator, fan, market, expiry } = await loadFixture(deploy);
      await expect(
        vault.connect(operator).purchasePolicy(id("p2"), fan.address, usd(6), 0, market, "x", expiry),
      ).to.be.revertedWithCustomError(vault, "ZeroPayout");
      await expect(
        vault.connect(operator).purchasePolicy(id("p2"), ethers.ZeroAddress, usd(6), usd(1), market, "x", expiry),
      ).to.be.revertedWithCustomError(vault, "ZeroAddress");
    });
  });

  describe("access control", () => {
    it("only operator can purchase or deposit", async () => {
      const { vault, stranger, fan, market, expiry } = await loadFixture(deploy);
      await expect(
        vault.connect(stranger).purchasePolicy(id("p1"), fan.address, usd(6), usd(75), market, "x", expiry),
      ).to.be.revertedWithCustomError(vault, "NotOperator");
      await expect(vault.connect(stranger).depositHedgeProceeds(usd(1), market)).to.be.revertedWithCustomError(
        vault,
        "NotOperator",
      );
    });

    it("only oracle can settle", async () => {
      const { vault, operator, market } = await loadFixture(withPolicy);
      await expect(vault.connect(operator).settleMarket(market, true, [id("p1")])).to.be.revertedWithCustomError(
        vault,
        "NotOracle",
      );
    });

    it("only owner can set roles and withdraw", async () => {
      const { vault, stranger, owner } = await loadFixture(deploy);
      await expect(vault.connect(stranger).setOperator(stranger.address)).to.be.revertedWithCustomError(
        vault,
        "OwnableUnauthorizedAccount",
      );
      await expect(vault.connect(stranger).setOracle(stranger.address)).to.be.revertedWithCustomError(
        vault,
        "OwnableUnauthorizedAccount",
      );
      await expect(vault.connect(stranger).withdrawSurplus(stranger.address, 0)).to.be.revertedWithCustomError(
        vault,
        "OwnableUnauthorizedAccount",
      );
      await expect(vault.connect(owner).setOracle(stranger.address))
        .to.emit(vault, "OracleUpdated")
        .withArgs(stranger.address);
      expect(await vault.oracle()).to.equal(stranger.address);
    });
  });

  describe("settleMarket", () => {
    it("pays the holder when triggered (after hedge proceeds land)", async () => {
      const { vault, operator, oracle, fan, usdc, market } = await loadFixture(withPolicy);
      // Gemini hedge: 75 contracts settle at $1 -> $75 deposited to reserves
      await expect(vault.connect(operator).depositHedgeProceeds(usd(75), market))
        .to.emit(vault, "HedgeProceedsDeposited")
        .withArgs(market, usd(75), operator.address);

      await expect(vault.connect(oracle).settleMarket(market, true, [id("p1")]))
        .to.emit(vault, "PolicySettled")
        .withArgs(id("p1"), market, true, usd(75))
        .and.to.emit(vault, "MarketSettled")
        .withArgs(market, true, 1n, usd(75));

      expect(await usdc.balanceOf(fan.address)).to.equal(usd(75));
      expect((await vault.getPolicy(id("p1"))).status).to.equal(2n); // PaidOut
      expect(await vault.totalLiability()).to.equal(0n);
      expect(await vault.totalPaidOut()).to.equal(usd(75));
    });

    it("expires the policy when not triggered", async () => {
      const { vault, oracle, fan, usdc, market } = await loadFixture(withPolicy);
      await expect(vault.connect(oracle).settleMarket(market, false, [id("p1")]))
        .to.emit(vault, "PolicySettled")
        .withArgs(id("p1"), market, false, 0n);
      expect(await usdc.balanceOf(fan.address)).to.equal(0n);
      expect((await vault.getPolicy(id("p1"))).status).to.equal(3n); // Expired
      expect(await vault.totalLiability()).to.equal(0n);
    });

    it("skips policies on other markets and already-settled policies", async () => {
      const { vault, operator, oracle, fan2, market, expiry } = await loadFixture(withPolicy);
      const other = id("OTHER");
      await vault.connect(operator).purchasePolicy(id("p2"), fan2.address, usd(2), usd(20), other, "other", expiry);
      await vault.connect(oracle).settleMarket(market, false, [id("p1"), id("p2"), id("missing")]);
      expect((await vault.getPolicy(id("p2"))).status).to.equal(1n); // still Active
      expect(await vault.totalLiability()).to.equal(usd(20));
      // settling p1 again is a no-op
      await expect(vault.connect(oracle).settleMarket(market, true, [id("p1")]))
        .to.emit(vault, "MarketSettled")
        .withArgs(market, true, 0n, 0n);
    });

    it("reverts when reserves cannot cover a triggered payout", async () => {
      const { vault, oracle, market } = await loadFixture(withPolicy);
      // only the $6 premium is in the vault, payout is $75
      await expect(vault.connect(oracle).settleMarket(market, true, [id("p1")])).to.be.revertedWithCustomError(
        vault,
        "InsufficientReserves",
      );
      expect((await vault.getPolicy(id("p1"))).status).to.equal(1n);
      expect(await vault.totalLiability()).to.equal(usd(75));
    });
  });

  describe("treasury", () => {
    it("reports coverage ratio", async () => {
      const { vault, operator, market } = await loadFixture(withPolicy);
      expect(await vault.coverageRatioBps()).to.equal((usd(6) * 10_000n) / usd(75));
      await vault.connect(operator).depositHedgeProceeds(usd(69), market);
      expect(await vault.coverageRatioBps()).to.equal(10_000n);
    });

    it("max coverage ratio with no liability", async () => {
      const { vault } = await loadFixture(deploy);
      expect(await vault.coverageRatioBps()).to.equal(ethers.MaxUint256);
    });

    it("only allows withdrawing reserves above outstanding liability", async () => {
      const { vault, operator, owner, stranger, usdc, market } = await loadFixture(withPolicy);
      await vault.connect(operator).depositHedgeProceeds(usd(100), market); // reserves 106, liability 75
      expect(await vault.surplus()).to.equal(usd(31));
      await expect(vault.connect(owner).withdrawSurplus(stranger.address, usd(32)))
        .to.be.revertedWithCustomError(vault, "ExceedsSurplus")
        .withArgs(usd(32), usd(31));
      await expect(vault.connect(owner).withdrawSurplus(stranger.address, usd(31)))
        .to.emit(vault, "SurplusWithdrawn")
        .withArgs(stranger.address, usd(31));
      expect(await usdc.balanceOf(stranger.address)).to.equal(usd(31));
      expect(await vault.surplus()).to.equal(0n);
      expect(await vault.reserves()).to.equal(usd(75));
    });

    it("surplus is zero when under-reserved", async () => {
      const { vault, owner, stranger } = await loadFixture(withPolicy);
      expect(await vault.surplus()).to.equal(0n);
      await expect(vault.connect(owner).withdrawSurplus(stranger.address, 1n)).to.be.revertedWithCustomError(
        vault,
        "ExceedsSurplus",
      );
    });
  });
});
