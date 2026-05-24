"""Small x402-compatible demo rail for agent-paid runtime calls.

This is intentionally a demo settlement layer: it speaks the 402 challenge /
payment-signature / payment-response shape, but does not move real funds.
"""

from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import uuid4

from fastapi.responses import JSONResponse
from starlette.datastructures import Headers

PAYMENT_REQUIRED_HEADER = "PAYMENT-REQUIRED"
PAYMENT_SIGNATURE_HEADER = "PAYMENT-SIGNATURE"
PAYMENT_RESPONSE_HEADER = "PAYMENT-RESPONSE"

DEMO_PRICE = {
    "amount": "0.001",
    "asset": "USDC",
    "network": "base-sepolia",
    "destination": "0x0000000000000000000000000000000000000402",
}


@dataclass(frozen=True)
class DemoPayment:
    payload: dict[str, object]
    settlement: dict[str, object]
    response_header: str


@dataclass(frozen=True)
class DemoPaymentRead:
    ok: bool
    payment: DemoPayment | None = None
    response: JSONResponse | None = None


def normalize_payment_intent(value: object) -> dict[str, object]:
    intent = value if isinstance(value, dict) else {}
    return {
        "walletBalanceUsd": _money(intent.get("walletBalanceUsd"), 100),
        "transferUsd": _money(intent.get("transferUsd"), 12),
        "recentMaxTransferUsd": _money(intent.get("recentMaxTransferUsd"), 20),
        "perTxLimitUsd": _money(intent.get("perTxLimitUsd"), 40),
        "recipientRisk": intent.get("recipientRisk")
        if intent.get("recipientRisk") in {"low", "unknown", "high"}
        else "low",
    }


def evaluate_payment_policy(value: object) -> dict[str, object]:
    intent = normalize_payment_intent(value)
    balance = max(float(intent["walletBalanceUsd"]), 0.01)
    per_tx_limit = max(float(intent["perTxLimitUsd"]), 0.01)
    transfer = float(intent["transferUsd"])
    ratio = transfer / balance

    if intent["recipientRisk"] == "high":
        return _policy("BLOCK", "critical", 95, "recipient is marked high risk", ["high-risk-recipient"], intent)
    if transfer >= balance:
        return _policy(
            "BLOCK",
            "critical",
            100,
            "transfer attempts to move 100% or more of wallet balance",
            ["full-balance-transfer"],
            intent,
        )
    if ratio > 0.5 and transfer > float(intent["recentMaxTransferUsd"]):
        return _policy(
            "WARN",
            "medium",
            min(89, round(ratio * 100)),
            "transfer is over 50% of balance and above the wallet's recent max",
            ["unusual-major-balance-transfer"],
            intent,
        )
    if intent["recipientRisk"] == "unknown" and ratio >= 0.25:
        return _policy(
            "WARN",
            "medium",
            min(79, round(ratio * 100)),
            "recipient is new or unknown for a material transfer",
            ["unknown-recipient-material-transfer"],
            intent,
        )
    if transfer > per_tx_limit:
        result = _policy(
            "REDACT",
            "high",
            min(84, round((transfer / per_tx_limit) * 35)),
            "transfer exceeds configured per-transaction cap; amount is capped before execution",
            ["per-transfer-cap"],
            intent,
        )
        result["adjustedTransferUsd"] = per_tx_limit
        return result

    return _policy(
        "PASS",
        "low",
        max(1, round(ratio * 25)),
        "payment intent is within balance, recipient and transfer-size policy",
        [],
        intent,
    )


def _encode_json(value: dict[str, object]) -> str:
    data = json.dumps(value, separators=(",", ":")).encode("utf-8")
    return base64.b64encode(data).decode("ascii")


def _decode_json(value: str) -> dict[str, object] | None:
    try:
        data = base64.b64decode(value.encode("ascii"), validate=True)
        decoded = json.loads(data.decode("utf-8"))
        return decoded if isinstance(decoded, dict) else None
    except Exception:
        return None


def _money(value: object, fallback: float) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return fallback
    if numeric < 0:
        return fallback
    return round(numeric, 2)


def _policy(
    verdict: str,
    severity: str,
    risk_score: int,
    reason: str,
    matched_rules: list[str],
    intent: dict[str, object],
) -> dict[str, object]:
    return {
        "verdict": verdict,
        "severity": severity,
        "riskScore": risk_score,
        "reason": reason,
        "matchedRules": matched_rules,
        "intent": intent,
    }


def build_demo_payment_required(resource: str) -> dict[str, object]:
    return {
        "x402Version": 2,
        "accepts": [
            {
                "scheme": "exact",
                **DEMO_PRICE,
                "resource": resource,
                "description": "ArkivGate protected agent runtime",
            }
        ],
    }


def create_payment_required_response(resource: str) -> JSONResponse:
    return JSONResponse(
        {
            "error": "payment_required",
            "detail": "x402 demo payment required for this agent runtime call",
        },
        status_code=402,
        headers={PAYMENT_REQUIRED_HEADER: _encode_json(build_demo_payment_required(resource))},
    )


def build_demo_payment_signature(
    resource: str,
    payer: str = "demo-agent",
    payment_intent: dict[str, object] | None = None,
) -> str:
    return _encode_json(
        {
            "x402Version": 2,
            "scheme": "exact",
            "network": DEMO_PRICE["network"],
            "resource": resource,
            "amount": DEMO_PRICE["amount"],
            "asset": DEMO_PRICE["asset"],
            "payer": payer,
            "paymentIntent": payment_intent,
            "nonce": str(uuid4()),
            "issuedAt": datetime.now(UTC).isoformat(),
            "demo": True,
        }
    )


def read_demo_payment(headers: Headers, resource: str) -> DemoPaymentRead:
    signature = headers.get(PAYMENT_SIGNATURE_HEADER)
    if not signature:
        return DemoPaymentRead(ok=False, response=create_payment_required_response(resource))

    payload = _decode_json(signature)
    valid = (
        payload is not None
        and payload.get("x402Version") == 2
        and payload.get("scheme") == "exact"
        and payload.get("demo") is True
        and payload.get("resource") == resource
        and payload.get("amount") == DEMO_PRICE["amount"]
        and payload.get("asset") == DEMO_PRICE["asset"]
        and payload.get("network") == DEMO_PRICE["network"]
        and isinstance(payload.get("payer"), str)
        and bool(str(payload.get("payer")).strip())
        and isinstance(payload.get("nonce"), str)
        and bool(str(payload.get("nonce")).strip())
    )
    if not valid or payload is None:
        return DemoPaymentRead(ok=False, response=create_payment_required_response(resource))

    settlement: dict[str, object] = {
        "success": True,
        "mode": "demo",
        "settled": False,
        "transaction": f"demo-x402-{payload['nonce']}",
        "payer": payload["payer"],
        "resource": resource,
        "amount": payload["amount"],
        "asset": payload["asset"],
        "network": payload["network"],
    }

    return DemoPaymentRead(
        ok=True,
        payment=DemoPayment(
            payload=payload,
            settlement=settlement,
            response_header=_encode_json(settlement),
        ),
    )
