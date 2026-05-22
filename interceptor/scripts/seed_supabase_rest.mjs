const projectId = process.env.SUPABASE_PROJECT_ID;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!projectId || !secret) {
  console.error("Missing SUPABASE_PROJECT_ID or SUPABASE_SECRET_KEY");
  process.exit(1);
}

const baseUrl = `https://${projectId}.supabase.co/rest/v1`;

function ago(days = 0, hours = 0) {
  return new Date(Date.now() - (days * 86_400_000 + hours * 3_600_000)).toISOString();
}

async function upsert(table, rows, onConflict) {
  const url = `${baseUrl}/${table}?on_conflict=${encodeURIComponent(onConflict)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: secret,
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
      "User-Agent": "node",
    },
    body: JSON.stringify(rows),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${table} upsert failed (${res.status}): ${text}`);
  }
  return text ? JSON.parse(text) : [];
}

const orgId = process.env.DEMO_ORG_ID || "demo";

const organization = [
  {
    id: orgId,
    name: orgId === "demo" ? "Acme Corp (demo)" : `Org ${orgId} (seed)`,
    email_domain: orgId === "demo" ? "acme.com" : null,
    upstream_api_key_ref: "env:ANTHROPIC_API_KEY",
    created_at: ago(60),
  },
];

const members = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    org_id: orgId,
    email: "admin@acme.com",
    role: "admin",
    created_at: ago(60),
  },
];

const policies = [
  { slug: "aws-access-key", domain: "credentials", layer: "regex", rule: "AWS Access Key ID expuesta en un prompt", pattern: "AKIA[0-9A-Z]{16}", default_action: "BLOCK", severity: "high" },
  { slug: "github-token", domain: "credentials", layer: "regex", rule: "GitHub Personal Access Token (classic o fine-grained)", pattern: "gh[pousr]_[A-Za-z0-9]{36,}", default_action: "BLOCK", severity: "high" },
  { slug: "pem-private-key", domain: "credentials", layer: "regex", rule: "Clave privada PEM en texto plano", pattern: "-----BEGIN (RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----", default_action: "BLOCK", severity: "high" },
  { slug: "anthropic-api-key", domain: "credentials", layer: "regex", rule: "Anthropic API key compartida en el prompt", pattern: "sk-ant-[A-Za-z0-9_\\-]{20,}", default_action: "BLOCK", severity: "high" },
  { slug: "openai-api-key", domain: "credentials", layer: "regex", rule: "OpenAI API key compartida en el prompt", pattern: "sk-[A-Za-z0-9]{48}", default_action: "BLOCK", severity: "high" },
  { slug: "db-connection-string", domain: "credentials", layer: "regex", rule: "Connection string de base de datos con credenciales embebidas", pattern: "(postgres(?:ql)?|mysql|mongodb)://[^:]+:[^@]+@", default_action: "REDACT", severity: "high" },
  { slug: "hardcoded-secret-env", domain: "credentials", layer: "regex", rule: "Variable de entorno con secreto hardcodeado (PASSWORD=, SECRET=, TOKEN=)", pattern: "(?i)(PASSWORD|SECRET|TOKEN|API_KEY)\\s*=\\s*[\"']?[A-Za-z0-9_\\-\\.]{8,}[\"']?", default_action: "REDACT", severity: "medium" },
  { slug: "credit-card-number", domain: "pii", layer: "regex", rule: "Numero de tarjeta de credito/debito en el prompt", pattern: "\\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\\b", default_action: "REDACT", severity: "high" },
  { slug: "national-id-rut", domain: "pii", layer: "regex", rule: "RUT chileno enviado a la API", pattern: "\\b\\d{7,8}-[\\dkK]\\b", default_action: "REDACT", severity: "medium" },
  { slug: "national-id-dni", domain: "pii", layer: "regex", rule: "DNI argentino (8 digitos seguidos) enviado a la API", pattern: "\\b\\d{8}\\b", default_action: "WARN", severity: "low" },
  { slug: "iban-number", domain: "pii", layer: "regex", rule: "Numero de cuenta bancaria IBAN", pattern: "\\b[A-Z]{2}\\d{2}[A-Z0-9]{4}\\d{7}([A-Z0-9]?){0,16}\\b", default_action: "REDACT", severity: "high" },
  { slug: "phone-number-bulk", domain: "pii", layer: "regex", rule: "Listado de numeros telefonicos (3 o mas en el mismo mensaje)", pattern: "(?:(?:\\+?\\d[\\d\\s\\-\\(\\)]{8,}){3,})", default_action: "WARN", severity: "medium" },
  { slug: "pii-health-records", domain: "pii", layer: "nl", rule: "Informacion medica o de salud de pacientes enviada a la API", pattern: null, default_action: "BLOCK", severity: "high" },
  { slug: "pii-financial-personal", domain: "pii", layer: "nl", rule: "Datos financieros personales de clientes (saldos, deudas, historial crediticio)", pattern: null, default_action: "REDACT", severity: "high" },
  { slug: "hardcoded-credentials-in-code", domain: "code", layer: "regex", rule: "Credenciales hardcodeadas en codigo fuente compartido con la API", pattern: "(?i)(password|passwd|pwd|api_key|apikey|secret)\\s*=\\s*[\"'][^\"']{6,}[\"']", default_action: "REDACT", severity: "high" },
  { slug: "security-check-bypass", domain: "code", layer: "regex", rule: "Comentario TODO/FIXME para eliminar validaciones de seguridad o autenticacion", pattern: "(?i)#\\s*(TODO|FIXME|HACK)\\s*:.*?(remove|skip|bypass|disable)\\s*(auth|security|check|validat)", default_action: "WARN", severity: "medium" },
  { slug: "code-without-tests", domain: "code", layer: "nl", rule: "Solicitud de implementacion de funcionalidad critica sin cobertura de tests", pattern: null, default_action: "WARN", severity: "medium" },
  { slug: "code-without-error-handling", domain: "code", layer: "nl", rule: "Solicitud de codigo que omite manejo de errores en operaciones de I/O o red", pattern: null, default_action: "WARN", severity: "low" },
  { slug: "disclose-internal-roadmap", domain: "business_policy", layer: "nl", rule: "Compartir roadmap de producto, planes de lanzamiento o funcionalidades no anunciadas", pattern: null, default_action: "BLOCK", severity: "high" },
  { slug: "disclose-pricing-strategy", domain: "business_policy", layer: "nl", rule: "Revelar estrategia de precios, descuentos o margenes no publicos a terceros", pattern: null, default_action: "BLOCK", severity: "high" },
  { slug: "competitor-direct-comparison", domain: "business_policy", layer: "nl", rule: "Solicitar comparacion directa de producto propio contra competidores con datos internos", pattern: null, default_action: "WARN", severity: "medium" },
  { slug: "confidential-company-objectives", domain: "business_policy", layer: "nl", rule: "Exposicion de OKRs, metas estrategicas o KPIs confidenciales de la empresa", pattern: null, default_action: "WARN", severity: "high" },
  { slug: "implementation-criteria-bypass", domain: "business_policy", layer: "nl", rule: "Solicitud que contradice criterios de implementacion aprobados por arquitectura", pattern: null, default_action: "WARN", severity: "medium" },
  { slug: "env-file-exposure", domain: "internal_paths", layer: "pattern", rule: "Contenido de archivos .env/.pem/.key/.p12 enviado al modelo", pattern: null, match_config: { extensions: [".env", ".pem", ".key", ".p12", ".pfx", ".cer"] }, default_action: "BLOCK", severity: "high" },
  { slug: "infrastructure-config", domain: "internal_paths", layer: "pattern", rule: "Archivos de infraestructura (Terraform/Kubernetes) con posibles credenciales", pattern: null, match_config: { paths: ["terraform/", "k8s/", "helm/", ".kube/"], filenames: ["docker-compose.prod.yml", "secrets.yaml", "values-prod.yaml"] }, default_action: "WARN", severity: "medium" },
].map((p) => ({
  id: crypto.randomUUID(),
  org_id: orgId,
  slug: p.slug,
  domain: p.domain,
  layer: p.layer,
  rule: p.rule,
  pattern: p.pattern,
  match_config: p.match_config ?? null,
  default_action: p.default_action,
  severity: p.severity,
  source: "seed",
  is_active: true,
  created_at: ago(60),
  updated_at: ago(0),
}));

async function main() {
  const org = await upsert("organizations", organization, "id");
  const mem = await upsert("members", members, "org_id,email");
  const pol = await upsert("policies", policies, "org_id,slug");

  console.log(JSON.stringify({
    ok: true,
    org: org.length,
    members: mem.length,
    policies: pol.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || String(error));
  process.exit(1);
});
