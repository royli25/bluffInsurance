import { test } from "node:test";
import assert from "node:assert/strict";
import { validateCheckoutQuote, type CheckoutQuote } from "../src/lib/checkout-quote";
import { openStore } from "../src/lib/store";
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
