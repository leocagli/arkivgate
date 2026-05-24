from starlette.datastructures import Headers

from app.x402_demo import (
    PAYMENT_REQUIRED_HEADER,
    build_demo_payment_signature,
    create_payment_required_response,
    read_demo_payment,
)


def test_payment_required_response_contains_challenge():
    response = create_payment_required_response("/cli/demo/v1/messages")

    assert response.status_code == 402
    assert response.headers[PAYMENT_REQUIRED_HEADER]


def test_missing_signature_requests_payment():
    result = read_demo_payment(Headers({}), "/cli/demo/v1/messages")

    assert result.ok is False
    assert result.response is not None
    assert result.response.status_code == 402


def test_demo_signature_passes_for_same_resource():
    signature = build_demo_payment_signature("/cli/demo/v1/messages", "agent_test_x402")
    result = read_demo_payment(
        Headers({"PAYMENT-SIGNATURE": signature}),
        "/cli/demo/v1/messages",
    )

    assert result.ok is True
    assert result.payment is not None
    assert result.payment.payload["payer"] == "agent_test_x402"
    assert result.payment.settlement["transaction"].startswith("demo-x402-")
    assert result.payment.response_header


def test_demo_signature_cannot_be_replayed_to_other_resource():
    signature = build_demo_payment_signature("/cli/demo/v1/messages", "agent_test_x402")
    result = read_demo_payment(
        Headers({"PAYMENT-SIGNATURE": signature}),
        "/cli/other/v1/messages",
    )

    assert result.ok is False
    assert result.response is not None
    assert result.response.status_code == 402
