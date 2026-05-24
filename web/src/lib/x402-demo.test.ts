import assert from "node:assert/strict";

import {
  buildDemoPaymentSignature,
  buildDemoPaymentSignatureWithIntent,
  createPaymentRequiredResponse,
  readDemoPayment,
} from "./x402-demo";

const required = createPaymentRequiredResponse("/api/playground/interceptor-test");
assert.equal(required.status, 402);
assert.ok(required.headers.get("PAYMENT-REQUIRED"));

const missing = readDemoPayment(new Headers(), "/api/playground/interceptor-test");
assert.equal(missing.ok, false);
assert.equal(missing.status, 402);

const signature = buildDemoPaymentSignature("/api/playground/interceptor-test");
const paid = readDemoPayment(
  new Headers({ "PAYMENT-SIGNATURE": signature }),
  "/api/playground/interceptor-test",
);
assert.equal(paid.ok, true);
assert.equal(paid.responseHeader.length > 20, true);

const paidWithIntent = readDemoPayment(
  new Headers({
    "PAYMENT-SIGNATURE": buildDemoPaymentSignatureWithIntent(
      "/api/playground/interceptor-test",
      "agent_demo_x402",
      {
        walletBalanceUsd: 100,
        transferUsd: 60,
        recentMaxTransferUsd: 20,
        perTxLimitUsd: 80,
        recipientRisk: "low",
      },
    ),
  }),
  "/api/playground/interceptor-test",
);
assert.equal(paidWithIntent.ok, true);
assert.equal(paidWithIntent.payment.paymentIntent?.transferUsd, 60);

const wrongResource = readDemoPayment(
  new Headers({ "PAYMENT-SIGNATURE": signature }),
  "/api/other",
);
assert.equal(wrongResource.ok, false);
assert.equal(wrongResource.status, 402);
