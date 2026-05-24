import type { PaymentIntent } from "@/lib/payment-policy";

const PAYMENT_REQUIRED_HEADER = "PAYMENT-REQUIRED";
const PAYMENT_SIGNATURE_HEADER = "PAYMENT-SIGNATURE";
const PAYMENT_RESPONSE_HEADER = "PAYMENT-RESPONSE";

const DEMO_PRICE = {
  amount: "0.001",
  asset: "USDC",
  network: "base-sepolia",
  destination: "0x0000000000000000000000000000000000000402",
} as const;

type DemoPaymentPayload = {
  x402Version: 2;
  scheme: "exact";
  network: string;
  resource: string;
  amount: string;
  asset: string;
  payer: string;
  paymentIntent?: PaymentIntent;
  nonce: string;
  issuedAt: string;
  demo: true;
};

type DemoSettlementResponse = {
  success: true;
  mode: "demo";
  settled: false;
  transaction: string;
  payer: string;
  resource: string;
  amount: string;
  asset: string;
  network: string;
};

function encodeJson(value: unknown): string {
  const json = JSON.stringify(value);
  if (typeof btoa === "function") return btoa(json);
  return Buffer.from(json, "utf8").toString("base64");
}

function decodeJson<T>(value: string): T | null {
  try {
    const json =
      typeof atob === "function"
        ? atob(value)
        : Buffer.from(value, "base64").toString("utf8");
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export function buildDemoPaymentRequired(resource: string) {
  return {
    x402Version: 2,
    accepts: [
      {
        scheme: "exact",
        ...DEMO_PRICE,
        resource,
        description: "ArkivGate playground policy execution",
      },
    ],
  };
}

export function createPaymentRequiredResponse(resource: string) {
  return Response.json(
    {
      error: "payment_required",
      detail: "x402 demo payment required for this playground execution",
    },
    {
      status: 402,
      headers: {
        [PAYMENT_REQUIRED_HEADER]: encodeJson(buildDemoPaymentRequired(resource)),
      },
    },
  );
}

export function buildDemoPaymentSignature(resource: string, payer = "demo-agent") {
  return buildDemoPaymentSignatureWithIntent(resource, payer);
}

export function buildDemoPaymentSignatureWithIntent(
  resource: string,
  payer = "demo-agent",
  paymentIntent?: PaymentIntent,
) {
  const payload: DemoPaymentPayload = {
    x402Version: 2,
    scheme: "exact",
    network: DEMO_PRICE.network,
    resource,
    amount: DEMO_PRICE.amount,
    asset: DEMO_PRICE.asset,
    payer,
    paymentIntent,
    nonce: crypto.randomUUID(),
    issuedAt: new Date().toISOString(),
    demo: true,
  };

  return encodeJson(payload);
}

export function readDemoPayment(headers: Headers, resource: string) {
  const signature = headers.get(PAYMENT_SIGNATURE_HEADER);
  if (!signature) {
    return {
      ok: false as const,
      status: 402,
      response: createPaymentRequiredResponse(resource),
    };
  }

  const payment = decodeJson<DemoPaymentPayload>(signature);
  const valid =
    payment?.x402Version === 2 &&
    payment.scheme === "exact" &&
    payment.demo === true &&
    payment.resource === resource &&
    payment.amount === DEMO_PRICE.amount &&
    payment.asset === DEMO_PRICE.asset &&
    payment.network === DEMO_PRICE.network &&
    typeof payment.payer === "string" &&
    payment.payer.trim().length > 0 &&
    typeof payment.nonce === "string" &&
    payment.nonce.trim().length > 0;

  if (!valid || !payment) {
    return {
      ok: false as const,
      status: 402,
      response: createPaymentRequiredResponse(resource),
    };
  }

  const settlement: DemoSettlementResponse = {
    success: true,
    mode: "demo",
    settled: false,
    transaction: `demo-x402-${payment.nonce}`,
    payer: payment.payer,
    resource,
    amount: payment.amount,
    asset: payment.asset,
    network: payment.network,
  };

  return {
    ok: true as const,
    payment,
    settlement,
    responseHeader: encodeJson(settlement),
  };
}

export function appendPaymentResponse(headers: Headers, paymentResponse: string) {
  headers.set(PAYMENT_RESPONSE_HEADER, paymentResponse);
}
