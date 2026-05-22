import { requireAdminRole } from "@/lib/admin-session";

type SetupItem = {
  key: string;
  label: string;
  ready: boolean;
  detail: string;
};

function hasValue(value: string | undefined | null) {
  return Boolean(value && value.trim().length > 0);
}

function sanitizeProxyUrl(value: string | undefined | null): string | null {
  if (!value || !value.trim()) return null;
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

async function probeProxyHealth(baseUrl: string | null) {
  if (!baseUrl) {
    return {
      reachable: true,
      status: null as number | null,
      detail: "Sin ArkivGate_PROXY_URL: modo embebido activo en web",
      mode: "embedded" as const,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(`${baseUrl}/health`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });

    const body = await response.text().catch(() => "");
    return {
      reachable: response.ok,
      status: response.status,
      detail: response.ok ? "Interceptor responde /health" : body || `HTTP ${response.status}`,
      mode: "direct" as const,
    };
  } catch (error) {
    return {
      reachable: false,
      status: null as number | null,
      detail: error instanceof Error ? error.message : "proxy unreachable",
      mode: "direct" as const,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  const auth = await requireAdminRole();
  if (!auth.ok) return auth.response;

  const isAuthConfigured = hasValue(process.env.GOOGLE_CLIENT_ID) && hasValue(process.env.GOOGLE_CLIENT_SECRET);
  const hasWallet = hasValue(process.env.ARKIV_AGENT_PRIVATE_KEY);
  const hasProject = hasValue(process.env.ARKIV_PROJECT);
  const hasChain = hasValue(process.env.ARKIV_CHAIN);
  const hasBridgeToken = hasValue(process.env.ARKIV_BRIDGE_TOKEN);
  const proxyUrl = sanitizeProxyUrl(process.env.ArkivGate_PROXY_URL);
  const proxyHealth = await probeProxyHealth(proxyUrl);
  const readyForCoreFlow = hasWallet && hasProject && hasChain;
  const readyForCurrentMode = readyForCoreFlow && proxyHealth.reachable;
  const readyForRealMode = readyForCurrentMode && hasBridgeToken && isAuthConfigured && Boolean(proxyUrl);

  const items: SetupItem[] = [
    {
      key: "wallet",
      label: "Arkiv agent wallet",
      ready: hasWallet,
      detail: hasWallet ? "Private key presente" : "Falta ARKIV_AGENT_PRIVATE_KEY",
    },
    {
      key: "project",
      label: "Arkiv project tag",
      ready: hasProject,
      detail: hasProject ? `ARKIV_PROJECT=${process.env.ARKIV_PROJECT}` : "Falta ARKIV_PROJECT",
    },
    {
      key: "chain",
      label: "Arkiv chain",
      ready: hasChain,
      detail: hasChain ? `ARKIV_CHAIN=${process.env.ARKIV_CHAIN}` : "Falta ARKIV_CHAIN",
    },
    {
      key: "bridge",
      label: "Bridge token",
      ready: hasBridgeToken,
      detail: hasBridgeToken ? "ARKIV_BRIDGE_TOKEN presente" : "Falta ARKIV_BRIDGE_TOKEN",
    },
    {
      key: "proxy",
      label: "Interceptor proxy",
      ready: proxyHealth.reachable,
      detail: proxyHealth.detail,
    },
    {
      key: "auth",
      label: "Google auth",
      ready: isAuthConfigured,
      detail: isAuthConfigured ? "GOOGLE_CLIENT_ID/SECRET presentes" : "Aun en modo demo",
    },
  ];

  return Response.json({
    ok: true,
    operatingMode: proxyHealth.mode,
    readyForCoreFlow,
    readyForCurrentMode,
    readyForRealMode,
    proxyHealth,
    items,
    recommendedNextSteps: [
      !proxyUrl ? "Si quieres modo real, setea ArkivGate_PROXY_URL al interceptor" : null,
      proxyUrl && !proxyHealth.reachable ? "El proxy no responde /health; revisar deploy del interceptor" : null,
      !isAuthConfigured ? "Configurar Google OAuth para quitar el bypass demo" : null,
      !hasBridgeToken ? "Definir ARKIV_BRIDGE_TOKEN en interceptor y web" : null,
    ].filter(Boolean),
  });
}