// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title BluffProtectionVault
/// @notice USDC-denominated parametric ticket protection. Each policy is tied to a
///         Gemini prediction-market contract (`marketRef`). The backend (operator)
///         buys the matching hedge on Gemini, and when the market resolves the
///         oracle settles every policy on that market: triggered -> USDC payout to
///         the fan, otherwise the policy expires.
contract BluffProtectionVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Status {
        None,
        Active,
        PaidOut,
        Expired
    }

    struct Policy {
        address holder;
        uint256 premium;
        uint256 payout;
        bytes32 marketRef;
        uint64 expiry;
        Status status;
    }

    IERC20 public immutable usdc;
    address public operator;
    address public oracle;

    mapping(bytes32 => Policy) public policies;
    /// @notice Sum of payouts owed by all Active policies.
    uint256 public totalLiability;
    uint256 public totalPremiums;
    uint256 public totalPaidOut;
    uint256 public policyCount;

    event OperatorUpdated(address indexed operator);
    event OracleUpdated(address indexed oracle);
    event PolicyPurchased(
        bytes32 indexed policyId,
        address indexed holder,
        bytes32 indexed marketRef,
        uint256 premium,
        uint256 payout,
        uint64 expiry,
        string triggerText
    );
    event HedgeProceedsDeposited(bytes32 indexed marketRef, uint256 amount, address indexed from);
    event PolicySettled(bytes32 indexed policyId, bytes32 indexed marketRef, bool triggered, uint256 paid);
    event MarketSettled(bytes32 indexed marketRef, bool triggered, uint256 policiesSettled, uint256 totalPaid);
    event SurplusWithdrawn(address indexed to, uint256 amount);

    error NotOperator();
    error NotOracle();
    error ZeroAddress();
    error ZeroPayout();
    error DuplicatePolicy(bytes32 policyId);
    error InsufficientReserves(uint256 needed, uint256 available);
    error ExceedsSurplus(uint256 requested, uint256 surplus);

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    modifier onlyOracle() {
        if (msg.sender != oracle) revert NotOracle();
        _;
    }

    constructor(address usdc_, address operator_, address oracle_) Ownable(msg.sender) {
        if (usdc_ == address(0) || operator_ == address(0) || oracle_ == address(0)) revert ZeroAddress();
        usdc = IERC20(usdc_);
        operator = operator_;
        oracle = oracle_;
        emit OperatorUpdated(operator_);
        emit OracleUpdated(oracle_);
    }

    // ---------------------------------------------------------------- admin

    function setOperator(address operator_) external onlyOwner {
        if (operator_ == address(0)) revert ZeroAddress();
        operator = operator_;
        emit OperatorUpdated(operator_);
    }

    function setOracle(address oracle_) external onlyOwner {
        if (oracle_ == address(0)) revert ZeroAddress();
        oracle = oracle_;
        emit OracleUpdated(oracle_);
    }

    // ------------------------------------------------------------- policies

    /// @notice Record a policy. The platform pays the premium in USDC on the fan's
    ///         behalf (the fan paid by card at checkout), so the crypto stays invisible.
    function purchasePolicy(
        bytes32 policyId,
        address holder,
        uint256 premium,
        uint256 payout,
        bytes32 marketRef,
        string calldata triggerText,
        uint64 expiry
    ) external onlyOperator nonReentrant {
        if (holder == address(0)) revert ZeroAddress();
        if (payout == 0) revert ZeroPayout();
        if (policies[policyId].status != Status.None) revert DuplicatePolicy(policyId);

        policies[policyId] = Policy({
            holder: holder,
            premium: premium,
            payout: payout,
            marketRef: marketRef,
            expiry: expiry,
            status: Status.Active
        });
        totalLiability += payout;
        totalPremiums += premium;
        policyCount += 1;

        if (premium > 0) usdc.safeTransferFrom(msg.sender, address(this), premium);

        emit PolicyPurchased(policyId, holder, marketRef, premium, payout, expiry, triggerText);
    }

    /// @notice Move USDC realised from the Gemini hedge into the vault's reserves.
    function depositHedgeProceeds(uint256 amount, bytes32 marketRef) external onlyOperator nonReentrant {
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit HedgeProceedsDeposited(marketRef, amount, msg.sender);
    }

    /// @notice Settle policies on a resolved Gemini market. Policies that are not
    ///         Active or reference a different market are skipped.
    function settleMarket(bytes32 marketRef, bool triggered, bytes32[] calldata policyIds)
        external
        onlyOracle
        nonReentrant
    {
        uint256 settled;
        uint256 paidTotal;
        for (uint256 i = 0; i < policyIds.length; i++) {
            bytes32 id = policyIds[i];
            Policy storage p = policies[id];
            if (p.status != Status.Active || p.marketRef != marketRef) continue;

            totalLiability -= p.payout;
            settled++;
            if (triggered) {
                uint256 bal = usdc.balanceOf(address(this));
                if (bal < p.payout) revert InsufficientReserves(p.payout, bal);
                p.status = Status.PaidOut;
                paidTotal += p.payout;
                totalPaidOut += p.payout;
                usdc.safeTransfer(p.holder, p.payout);
                emit PolicySettled(id, marketRef, true, p.payout);
            } else {
                p.status = Status.Expired;
                emit PolicySettled(id, marketRef, false, 0);
            }
        }
        emit MarketSettled(marketRef, triggered, settled, paidTotal);
    }

    // ------------------------------------------------------------- treasury

    function reserves() public view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    function surplus() public view returns (uint256) {
        uint256 bal = reserves();
        return bal > totalLiability ? bal - totalLiability : 0;
    }

    /// @notice Reserves / liability in basis points (10_000 = fully covered).
    ///         Returns type(uint256).max when there is no outstanding liability.
    function coverageRatioBps() external view returns (uint256) {
        if (totalLiability == 0) return type(uint256).max;
        return (reserves() * 10_000) / totalLiability;
    }

    function withdrawSurplus(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        uint256 s = surplus();
        if (amount > s) revert ExceedsSurplus(amount, s);
        usdc.safeTransfer(to, amount);
        emit SurplusWithdrawn(to, amount);
    }

    function getPolicy(bytes32 policyId) external view returns (Policy memory) {
        return policies[policyId];
    }
}
