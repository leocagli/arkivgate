import assert from "node:assert/strict";

import { evaluatePaymentPolicy, worstVerdict } from "./payment-policy";

assert.equal(
  evaluatePaymentPolicy({
    walletBalanceUsd: 100,
    transferUsd: 8,
    recentMaxTransferUsd: 20,
    perTxLimitUsd: 40,
    recipientRisk: "low",
  }).verdict,
  "PASS",
);

assert.equal(
  evaluatePaymentPolicy({
    walletBalanceUsd: 100,
    transferUsd: 100,
    recentMaxTransferUsd: 20,
    perTxLimitUsd: 40,
    recipientRisk: "low",
  }).verdict,
  "BLOCK",
);

assert.equal(
  evaluatePaymentPolicy({
    walletBalanceUsd: 100,
    transferUsd: 60,
    recentMaxTransferUsd: 20,
    perTxLimitUsd: 80,
    recipientRisk: "low",
  }).verdict,
  "WARN",
);

const redacted = evaluatePaymentPolicy({
  walletBalanceUsd: 100,
  transferUsd: 45,
  recentMaxTransferUsd: 60,
  perTxLimitUsd: 30,
  recipientRisk: "low",
});
assert.equal(redacted.verdict, "REDACT");
assert.equal(redacted.adjustedTransferUsd, 30);

assert.equal(worstVerdict(["PASS", "WARN"]), "WARN");
assert.equal(worstVerdict(["PASS", "REDACT", "WARN"]), "REDACT");
assert.equal(worstVerdict(["PASS", "BLOCK", "REDACT"]), "BLOCK");
