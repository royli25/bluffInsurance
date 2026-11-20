import { test } from "node:test";
import assert from "node:assert/strict";
import { validateCheckoutQuote, type CheckoutQuote } from "../src/lib/checkout-quote";
import { openStore, UNSAVED_OFFER_VERSION } from "../src/lib/store";
import { policy } from "./helpers/streams-fixtures";

const selection = { eventId: "test", tierId: "upper", qty: 2, rooting: "home" as const };
const quote: CheckoutQuote = {
  ...selection, id: "quote-test", offerVersion: "v1", source: "live", options: [],
  createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 30_000).toISOString(), marketFetchedAt: new Date().toISOString(),
};

test("quote expiry, ticket selection and changed offer require a new quote", () => {
  assert.strictEqual(validateCheckoutQuote(quote, selection, "v1"), quote);
  assert.throws(() => validateCheckoutQuote(undefined, selection, "v1"), /expired/);
  assert.throws(() => validateCheckoutQuote(quote, selection, "v1", Date.parse(quote.expiresAt)), /expired/);
  for (const field of [{ qty: 3 }, { tierId: "lower" }, { eventId: "other" }, { rooting: "away" }])
    assert.throws(() => validateCheckoutQuote(quote, { ...selection, ...field }, "v1"), /tickets changed/);
  assert.throws(() => validateCheckoutQuote(quote, selection, "v2"), /Protection changed/);
});

test("quote consumption is atomic with the policy and expired quotes cannot be consumed", () => {
  const store = openStore(":memory:");
  try {
    store.saveQuote(quote);
    assert.deepEqual(store.checkoutQuote(quote.id), quote);
    const p = { ...policy("quoted-policy"), quoteId: quote.id };
    store.addPolicy(p);
    assert.throws(() => store.addPolicy({ ...p, id: "different-order" }), /already used/);
    assert.equal(store.policies().length, 1);
    store.saveQuote({ ...quote, id: "expired", expiresAt: new Date(Date.now() - 1).toISOString() });
    assert.throws(() => store.addPolicy({ ...p, id: "expired-order", quoteId: "expired" }), /expired/);
    assert.equal(store.policies().length, 1);
    assert.throws(() => store.addPolicy({ ...p, id: "invalid-order", quoteId: "not-real" }), /expired/);
  } finally { store.close(); }
});

test("the first save of an unsaved default offer passes the version check", () => {
  const store = openStore(":memory:");
  try {
    const draft = { eventId: "event", published: true, updatedAt: new Date().toISOString(), coverages: { "team-loses": { enabled: true, refundPct: 15 } } };
    assert.throws(() => store.setOffer(draft, "2026-01-01T00:00:00.000Z"), /changed elsewhere/);
    const saved = store.setOffer(draft, UNSAVED_OFFER_VERSION);
    assert.throws(() => store.setOffer(draft, UNSAVED_OFFER_VERSION), /changed elsewhere/);
    assert.equal(store.offer("event")?.updatedAt, saved.updatedAt);
  } finally { store.close(); }
});

test("provider settings use atomic versions even when writes share a millisecond", () => {
  const store = openStore(":memory:");
  try {
    const first = store.setOffer({ eventId: "event", published: true, updatedAt: "2026-01-01T00:00:00.000Z", coverages: { "team-loses": { enabled: true, refundPct: 15 } } });
    const second = store.setOffer({ ...first, coverages: { "team-loses": { enabled: true, refundPct: 15, providers: { kalshi: false } } } }, first.updatedAt);
    assert.ok(Date.parse(second.updatedAt) > Date.parse(first.updatedAt));
    assert.throws(() => store.setOffer(first, first.updatedAt), /changed elsewhere/);
    assert.equal(store.offer("event")?.coverages["team-loses"]?.providers?.kalshi, false);
  } finally { store.close(); }
});
