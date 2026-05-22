import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel function timeout

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ago(days = 0, hours = 0): Date {
  return new Date(Date.now() - (days * 86_400_000 + hours * 3_600_000));
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

// ---------------------------------------------------------------------------
// Org + Member
// ---------------------------------------------------------------------------

const ORG = {
  id: "demo",
  name: "Acme Corp (demo)",
  emailDomain: "acme.com",
  upstreamApiKeyRef: "env:ANTHROPIC_API_KEY",
  createdAt: ago(60),
};

const MEMBER = {
  id: "00000000-0000-0000-0000-000000000001",
  orgId: "demo",
  email: "admin@acme.com",
  role: "admin" as const,
  createdAt: ago(60),
};

// ---------------------------------------------------------------------------
// Policies  (25)
// ---------------------------------------------------------------------------

type PolicySeed = {
  slug: string;
  domain: "credentials" | "pii" | "code" | "business_policy" | "internal_paths";
  layer: "regex" | "pattern" | "nl";
  rule: string;
  pattern?: string | null;
  matchConfig?: unknown;
  defaultAction: "BLOCK" | "REDACT" | "WARN" | "LOG";
  severity: "low" | "medium" | "high";
};

const POLICIES: PolicySeed[] = [
  // ── credentials / regex
  { slug: "aws-access-key", domain: "credentials", layer: "regex", rule: "AWS Access Key ID expuesta en un prompt", pattern: "AKIA[0-9A-Z]{16}", defaultAction: "BLOCK", severity: "high" },
  { slug: "github-token", domain: "credentials", layer: "regex", rule: "GitHub Personal Access Token (classic o fine-grained)", pattern: "gh[pousr]_[A-Za-z0-9]{36,}", defaultAction: "BLOCK", severity: "high" },
  { slug: "pem-private-key", domain: "credentials", layer: "regex", rule: "Clave privada PEM en texto plano", pattern: "-----BEGIN (RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----", defaultAction: "BLOCK", severity: "high" },
  { slug: "anthropic-api-key", domain: "credentials", layer: "regex", rule: "Anthropic API key compartida en el prompt", pattern: "sk-ant-[A-Za-z0-9_\\-]{20,}", defaultAction: "BLOCK", severity: "high" },
  { slug: "openai-api-key", domain: "credentials", layer: "regex", rule: "OpenAI API key compartida en el prompt", pattern: "sk-[A-Za-z0-9]{48}", defaultAction: "BLOCK", severity: "high" },
  { slug: "db-connection-string", domain: "credentials", layer: "regex", rule: "Connection string de base de datos con credenciales embebidas", pattern: "(postgres(?:ql)?|mysql|mongodb)://[^:]+:[^@]+@", defaultAction: "REDACT", severity: "high" },
  { slug: "hardcoded-secret-env", domain: "credentials", layer: "regex", rule: "Variable de entorno con secreto hardcodeado (PASSWORD=, SECRET=, TOKEN=)", pattern: "(?i)(PASSWORD|SECRET|TOKEN|API_KEY)\\s*=\\s*[\"']?[A-Za-z0-9_\\-\\.]{8,}[\"']?", defaultAction: "REDACT", severity: "medium" },
  // ── pii / regex
  { slug: "credit-card-number", domain: "pii", layer: "regex", rule: "Numero de tarjeta de credito/debito en el prompt", pattern: "\\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\\b", defaultAction: "REDACT", severity: "high" },
  { slug: "national-id-rut", domain: "pii", layer: "regex", rule: "RUT chileno enviado a la API", pattern: "\\b\\d{7,8}-[\\dkK]\\b", defaultAction: "REDACT", severity: "medium" },
  { slug: "national-id-dni", domain: "pii", layer: "regex", rule: "DNI argentino (8 digitos seguidos) enviado a la API", pattern: "\\b\\d{8}\\b", defaultAction: "WARN", severity: "low" },
  { slug: "iban-number", domain: "pii", layer: "regex", rule: "Numero de cuenta bancaria IBAN", pattern: "\\b[A-Z]{2}\\d{2}[A-Z0-9]{4}\\d{7}([A-Z0-9]?){0,16}\\b", defaultAction: "REDACT", severity: "high" },
  { slug: "phone-number-bulk", domain: "pii", layer: "regex", rule: "Listado de numeros telefonicos (3 o mas en el mismo mensaje)", pattern: "(?:(?:\\+?\\d[\\d\\s\\-\\(\\)]{8,}){3,})", defaultAction: "WARN", severity: "medium" },
  // ── pii / nl
  { slug: "pii-health-records", domain: "pii", layer: "nl", rule: "Informacion medica o de salud de pacientes enviada a la API", defaultAction: "BLOCK", severity: "high" },
  { slug: "pii-financial-personal", domain: "pii", layer: "nl", rule: "Datos financieros personales de clientes (saldos, deudas, historial crediticio)", defaultAction: "REDACT", severity: "high" },
  // ── code / regex
  { slug: "hardcoded-credentials-in-code", domain: "code", layer: "regex", rule: "Credenciales hardcodeadas en codigo fuente compartido con la API", pattern: "(?i)(password|passwd|pwd|api_key|apikey|secret)\\s*=\\s*[\"'][^\"']{6,}[\"']", defaultAction: "REDACT", severity: "high" },
  { slug: "security-check-bypass", domain: "code", layer: "regex", rule: "Comentario TODO/FIXME para eliminar validaciones de seguridad o autenticacion", pattern: "(?i)#\\s*(TODO|FIXME|HACK)\\s*:.*?(remove|skip|bypass|disable)\\s*(auth|security|check|validat)", defaultAction: "WARN", severity: "medium" },
  // ── code / nl
  { slug: "code-without-tests", domain: "code", layer: "nl", rule: "Solicitud de implementacion de funcionalidad critica sin cobertura de tests", defaultAction: "WARN", severity: "medium" },
  { slug: "code-without-error-handling", domain: "code", layer: "nl", rule: "Solicitud de codigo que omite manejo de errores en operaciones de I/O o red", defaultAction: "WARN", severity: "low" },
  // ── business_policy / nl
  { slug: "disclose-internal-roadmap", domain: "business_policy", layer: "nl", rule: "Compartir roadmap de producto, planes de lanzamiento o funcionalidades no anunciadas", defaultAction: "BLOCK", severity: "high" },
  { slug: "disclose-pricing-strategy", domain: "business_policy", layer: "nl", rule: "Revelar estrategia de precios, descuentos o margenes no publicos a terceros", defaultAction: "BLOCK", severity: "high" },
  { slug: "competitor-direct-comparison", domain: "business_policy", layer: "nl", rule: "Solicitar comparacion directa de producto propio contra competidores con datos internos", defaultAction: "WARN", severity: "medium" },
  { slug: "confidential-company-objectives", domain: "business_policy", layer: "nl", rule: "Exposicion de OKRs, metas estrategicas o KPIs confidenciales de la empresa", defaultAction: "WARN", severity: "high" },
  { slug: "implementation-criteria-bypass", domain: "business_policy", layer: "nl", rule: "Solicitud que contradice los criterios de implementacion aprobados por arquitectura (ej. evadir code review, CI/CD o pair programming)", defaultAction: "WARN", severity: "medium" },
  // ── internal_paths / pattern
  { slug: "env-file-exposure", domain: "internal_paths", layer: "pattern", rule: "Contenido de archivos .env, .pem, .key o .p12 enviado al modelo", matchConfig: { extensions: [".env", ".pem", ".key", ".p12", ".pfx", ".cer"] }, defaultAction: "BLOCK", severity: "high" },
  { slug: "infrastructure-config", domain: "internal_paths", layer: "pattern", rule: "Archivos de configuracion de infraestructura (Terraform, Kubernetes, Docker secrets) con posibles credenciales", matchConfig: { paths: ["terraform/", "k8s/", "helm/", ".kube/"], filenames: ["docker-compose.prod.yml", "secrets.yaml", "values-prod.yaml"] }, defaultAction: "WARN", severity: "medium" },
];

// ---------------------------------------------------------------------------
// Interactions (25)
// ---------------------------------------------------------------------------

const MODEL = "claude-sonnet-4-6";

type InteractionSeed = {
  traceId: string;
  requestModel: string;
  prompt: string;
  action: "BLOCK" | "REDACT" | "WARN" | "LOG";
  reason: string;
  policyHits: unknown[];
  latencyTotalMs: number;
  latencyByLayer: Record<string, number>;
  upstreamStatus: number | null;
  createdAt: Date;
};

const INTERACTIONS: InteractionSeed[] = [
  // ── LOG
  { traceId: "tr-log-001", requestModel: MODEL, prompt: "Escribi una funcion en Python que calcule el factorial de un numero usando recursion.", action: "LOG", reason: "No se detectaron politicas aplicables. Request permitido.", policyHits: [], latencyTotalMs: 42, latencyByLayer: { regex: 2, pattern: 1, haiku: 0, upstream: 39 }, upstreamStatus: 200, createdAt: ago(28, 3) },
  { traceId: "tr-log-002", requestModel: MODEL, prompt: "Refactoriza este componente React para extraer la logica de fetch a un custom hook.", action: "LOG", reason: "No se detectaron politicas aplicables. Request permitido.", policyHits: [], latencyTotalMs: 38, latencyByLayer: { regex: 2, pattern: 1, haiku: 0, upstream: 35 }, upstreamStatus: 200, createdAt: ago(25, 7) },
  { traceId: "tr-log-003", requestModel: MODEL, prompt: "Explicame el patron Observer en TypeScript con un ejemplo de Event Emitter.", action: "LOG", reason: "No se detectaron politicas aplicables. Request permitido.", policyHits: [], latencyTotalMs: 55, latencyByLayer: { regex: 3, pattern: 1, haiku: 0, upstream: 51 }, upstreamStatus: 200, createdAt: ago(22, 11) },
  { traceId: "tr-log-004", requestModel: MODEL, prompt: "Como configuro un indice GIN en PostgreSQL para busqueda full-text en espanol?", action: "LOG", reason: "No se detectaron politicas aplicables. Request permitido.", policyHits: [], latencyTotalMs: 47, latencyByLayer: { regex: 2, pattern: 1, haiku: 0, upstream: 44 }, upstreamStatus: 200, createdAt: ago(19, 2) },
  { traceId: "tr-log-005", requestModel: MODEL, prompt: "Genera un Dockerfile multi-stage para una app Node.js con build de TypeScript.", action: "LOG", reason: "No se detectaron politicas aplicables. Request permitido.", policyHits: [], latencyTotalMs: 61, latencyByLayer: { regex: 3, pattern: 2, haiku: 0, upstream: 56 }, upstreamStatus: 200, createdAt: ago(15, 9) },
  { traceId: "tr-log-006", requestModel: MODEL, prompt: "Como implemento paginacion cursor-based en una API GraphQL con Relay spec?", action: "LOG", reason: "No se detectaron politicas aplicables. Request permitido.", policyHits: [], latencyTotalMs: 44, latencyByLayer: { regex: 2, pattern: 1, haiku: 0, upstream: 41 }, upstreamStatus: 200, createdAt: ago(10, 14) },
  { traceId: "tr-log-007", requestModel: MODEL, prompt: "Necesito un script de bash que haga backup de una carpeta y la suba a S3 usando la AWS CLI.", action: "LOG", reason: "No se detectaron politicas aplicables. Request permitido.", policyHits: [], latencyTotalMs: 39, latencyByLayer: { regex: 3, pattern: 1, haiku: 0, upstream: 35 }, upstreamStatus: 200, createdAt: ago(6, 5) },
  { traceId: "tr-log-008", requestModel: MODEL, prompt: "Escribi tests unitarios para esta funcion de validacion de formulario en Jest.", action: "LOG", reason: "No se detectaron politicas aplicables. Request permitido.", policyHits: [], latencyTotalMs: 52, latencyByLayer: { regex: 2, pattern: 1, haiku: 0, upstream: 49 }, upstreamStatus: 200, createdAt: ago(2, 3) },
  // ── WARN
  { traceId: "tr-warn-001", requestModel: MODEL, prompt: "Ayudame a armar una presentacion comparando nuestros precios con los de la competencia para el cliente Enterprise.", action: "WARN", reason: "Politica 'competitor-direct-comparison': solicitud con datos internos de precios hacia comparacion competitiva.", policyHits: [{ layer: "nl", slug: "competitor-direct-comparison", score: 0.87 }], latencyTotalMs: 198, latencyByLayer: { regex: 4, pattern: 2, haiku: 142, upstream: 50 }, upstreamStatus: 200, createdAt: ago(27, 6) },
  { traceId: "tr-warn-002", requestModel: MODEL, prompt: "Podes resumir los OKRs del equipo de producto para Q3 y Q4 de este ano?", action: "WARN", reason: "Politica 'confidential-company-objectives': exposicion de objetivos estrategicos internos.", policyHits: [{ layer: "nl", slug: "confidential-company-objectives", score: 0.91 }], latencyTotalMs: 187, latencyByLayer: { regex: 3, pattern: 1, haiku: 138, upstream: 45 }, upstreamStatus: 200, createdAt: ago(21, 10) },
  { traceId: "tr-warn-003", requestModel: MODEL, prompt: "Implementa este endpoint sin tests, el deadline es manana y no tenemos tiempo.", action: "WARN", reason: "Politica 'code-without-tests': solicitud de implementacion critica sin cobertura de tests.", policyHits: [{ layer: "nl", slug: "code-without-tests", score: 0.83 }], latencyTotalMs: 175, latencyByLayer: { regex: 3, pattern: 1, haiku: 131, upstream: 40 }, upstreamStatus: 200, createdAt: ago(16, 8) },
  { traceId: "tr-warn-004", requestModel: MODEL, prompt: "# TODO: remove auth check before demo\ndef get_user_data(id): return db.query(id)", action: "WARN", reason: "Politica 'security-check-bypass': comentario para deshabilitar validacion de autenticacion.", policyHits: [{ layer: "regex", slug: "security-check-bypass", score: null }], latencyTotalMs: 22, latencyByLayer: { regex: 18, pattern: 2, haiku: 0, upstream: 2 }, upstreamStatus: 200, createdAt: ago(12, 4) },
  { traceId: "tr-warn-005", requestModel: MODEL, prompt: "Explicame los criterios de implementacion del equipo. Necesito saber como evitar el proceso de code review para este hotfix.", action: "WARN", reason: "Politica 'implementation-criteria-bypass': intencion de evadir proceso de code review.", policyHits: [{ layer: "nl", slug: "implementation-criteria-bypass", score: 0.89 }], latencyTotalMs: 192, latencyByLayer: { regex: 3, pattern: 1, haiku: 145, upstream: 43 }, upstreamStatus: 200, createdAt: ago(8, 15) },
  { traceId: "tr-warn-006", requestModel: MODEL, prompt: "El archivo terraform/prod/main.tf tiene las variables de RDS, podes revisarlo y decirme si esta bien configurado?", action: "WARN", reason: "Politica 'infrastructure-config': archivo de infraestructura de produccion con posibles credenciales.", policyHits: [{ layer: "pattern", slug: "infrastructure-config", score: null }], latencyTotalMs: 31, latencyByLayer: { regex: 4, pattern: 24, haiku: 0, upstream: 3 }, upstreamStatus: 200, createdAt: ago(3, 11) },
  // ── REDACT
  { traceId: "tr-redact-001", requestModel: MODEL, prompt: "Como conecto a la base de datos de produccion? La URL es postgresql://admin:[REDACTED]@prod.db.acme.com:5432/main", action: "REDACT", reason: "Politica 'db-connection-string': credenciales de base de datos enmascaradas.", policyHits: [{ layer: "regex", slug: "db-connection-string", score: null }], latencyTotalMs: 19, latencyByLayer: { regex: 15, pattern: 2, haiku: 0, upstream: 2 }, upstreamStatus: 200, createdAt: ago(26, 4) },
  { traceId: "tr-redact-002", requestModel: MODEL, prompt: "El usuario Juan Garcia (DNI [REDACTED], email juan.garcia@cliente.com) necesita resetear su contrasena. Como proceso este caso?", action: "REDACT", reason: "Politica 'national-id-dni': DNI argentino detectado y enmascarado.", policyHits: [{ layer: "regex", slug: "national-id-dni", score: null }], latencyTotalMs: 24, latencyByLayer: { regex: 19, pattern: 2, haiku: 0, upstream: 3 }, upstreamStatus: 200, createdAt: ago(20, 9) },
  { traceId: "tr-redact-003", requestModel: MODEL, prompt: "Procesa este pago: tarjeta [REDACTED], vencimiento 12/26, CVV [REDACTED]. Monto: $150.000.", action: "REDACT", reason: "Politica 'credit-card-number': numero de tarjeta de credito enmascarado.", policyHits: [{ layer: "regex", slug: "credit-card-number", score: null }], latencyTotalMs: 17, latencyByLayer: { regex: 13, pattern: 2, haiku: 0, upstream: 2 }, upstreamStatus: 200, createdAt: ago(17, 13) },
  { traceId: "tr-redact-004", requestModel: MODEL, prompt: "const config = { apiKey: [REDACTED], endpoint: 'https://api.prod.acme.com' }; como uso esto en el cliente?", action: "REDACT", reason: "Politica 'hardcoded-credentials-in-code': API key hardcodeada enmascarada en codigo fuente.", policyHits: [{ layer: "regex", slug: "hardcoded-credentials-in-code", score: null }], latencyTotalMs: 21, latencyByLayer: { regex: 17, pattern: 2, haiku: 0, upstream: 2 }, upstreamStatus: 200, createdAt: ago(13, 7) },
  { traceId: "tr-redact-005", requestModel: MODEL, prompt: "RUT del cliente: [REDACTED]. Verifica si esta habilitado para operar en el sistema.", action: "REDACT", reason: "Politica 'national-id-rut': RUT chileno detectado y enmascarado.", policyHits: [{ layer: "regex", slug: "national-id-rut", score: null }], latencyTotalMs: 16, latencyByLayer: { regex: 12, pattern: 2, haiku: 0, upstream: 2 }, upstreamStatus: 200, createdAt: ago(9, 3) },
  { traceId: "tr-redact-006", requestModel: MODEL, prompt: "Los datos financieros del cliente Maria Lopez (cuenta [REDACTED], saldo disponible $[REDACTED]) necesitan ser migrados al nuevo sistema.", action: "REDACT", reason: "Politica 'pii-financial-personal': datos financieros personales identificados y enmascarados.", policyHits: [{ layer: "nl", slug: "pii-financial-personal", score: 0.92 }], latencyTotalMs: 204, latencyByLayer: { regex: 5, pattern: 2, haiku: 155, upstream: 42 }, upstreamStatus: 200, createdAt: ago(4, 16) },
  // ── BLOCK
  { traceId: "tr-block-001", requestModel: MODEL, prompt: "Mi AWS Access Key es AKIAIOSFODNN7EXAMPLE. Como la uso para subir archivos a S3?", action: "BLOCK", reason: "Politica 'aws-access-key': AWS Access Key ID detectada. Request bloqueado para evitar exfiltracion.", policyHits: [{ layer: "regex", slug: "aws-access-key", score: null }], latencyTotalMs: 14, latencyByLayer: { regex: 11, pattern: 2, haiku: 0, upstream: 0 }, upstreamStatus: null, createdAt: ago(24, 2) },
  { traceId: "tr-block-002", requestModel: MODEL, prompt: "Token de GitHub: ghp_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA. Ayudame a listar mis repositorios privados.", action: "BLOCK", reason: "Politica 'github-token': GitHub Personal Access Token detectado. Request bloqueado.", policyHits: [{ layer: "regex", slug: "github-token", score: null }], latencyTotalMs: 12, latencyByLayer: { regex: 9, pattern: 2, haiku: 0, upstream: 0 }, upstreamStatus: null, createdAt: ago(18, 17) },
  { traceId: "tr-block-003", requestModel: MODEL, prompt: "La key de Anthropic es sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxx. Como la configuro en el proyecto?", action: "BLOCK", reason: "Politica 'anthropic-api-key': Anthropic API key detectada. Request bloqueado.", policyHits: [{ layer: "regex", slug: "anthropic-api-key", score: null }], latencyTotalMs: 11, latencyByLayer: { regex: 8, pattern: 2, haiku: 0, upstream: 0 }, upstreamStatus: null, createdAt: ago(11, 8) },
  { traceId: "tr-block-004", requestModel: MODEL, prompt: "El paciente Roberto Silva tiene diabetes tipo 2 y presion alta. Generame un plan de medicacion.", action: "BLOCK", reason: "Politica 'pii-health-records': informacion medica sensible de paciente. Request bloqueado.", policyHits: [{ layer: "nl", slug: "pii-health-records", score: 0.96 }], latencyTotalMs: 189, latencyByLayer: { regex: 4, pattern: 2, haiku: 183, upstream: 0 }, upstreamStatus: null, createdAt: ago(7, 12) },
  { traceId: "tr-block-005", requestModel: MODEL, prompt: "Necesito que redactes el anuncio del lanzamiento de nuestra feature de pagos para Q2, con las fechas exactas de release.", action: "BLOCK", reason: "Politica 'disclose-internal-roadmap': exposicion de roadmap de producto no anunciado. Request bloqueado.", policyHits: [{ layer: "nl", slug: "disclose-internal-roadmap", score: 0.93 }], latencyTotalMs: 194, latencyByLayer: { regex: 3, pattern: 1, haiku: 188, upstream: 0 }, upstreamStatus: null, createdAt: ago(1, 6) },
];

// ---------------------------------------------------------------------------
// Rule Suggestions (6)
// ---------------------------------------------------------------------------

type SuggestionSeed = {
  id: string;
  proposedSlug: string;
  proposedDomain: "credentials" | "pii" | "code" | "business_policy" | "internal_paths";
  proposedLayer: "regex" | "pattern" | "nl";
  proposedRule: string;
  proposedPattern?: string | null;
  proposedMatchConfig?: unknown;
  proposedAction: "BLOCK" | "REDACT" | "WARN" | "LOG";
  proposedSeverity: "low" | "medium" | "high";
  matchCount: number;
  examples: unknown[];
  status: "pending" | "accepted" | "rejected";
  rejectReason?: string | null;
  createdAt: Date;
  decidedAt?: Date | null;
};

const SUGGESTIONS: SuggestionSeed[] = [
  { id: "10000000-0000-0000-0000-000000000001", proposedSlug: "salary-information", proposedDomain: "business_policy", proposedLayer: "nl", proposedRule: "Informacion salarial, bandas de compensacion o datos de equity de empleados compartidos en prompts", proposedAction: "BLOCK", proposedSeverity: "high", matchCount: 3, examples: [{ traceId: "tr-log-006", promptRedacted: "Cual es la banda salarial para un Senior Engineer?", createdAt: ago(10, 14).toISOString() }], status: "pending", createdAt: ago(5, 2) },
  { id: "10000000-0000-0000-0000-000000000002", proposedSlug: "employee-personal-data", proposedDomain: "pii", proposedLayer: "nl", proposedRule: "Datos personales de empleados (legajo, CUIL, domicilio) enviados a la API", proposedAction: "REDACT", proposedSeverity: "high", matchCount: 5, examples: [{ traceId: "tr-redact-002", promptRedacted: "El empleado [REDACTED] con CUIL [REDACTED] necesita...", createdAt: ago(20, 9).toISOString() }], status: "pending", createdAt: ago(3, 7) },
  { id: "10000000-0000-0000-0000-000000000003", proposedSlug: "confidential-project-names", proposedDomain: "business_policy", proposedLayer: "nl", proposedRule: "Nombres en clave de proyectos confidenciales (Proyecto Condor, Proyecto Atlas) mencionados en prompts", proposedAction: "WARN", proposedSeverity: "medium", matchCount: 2, examples: [], status: "pending", createdAt: ago(1, 15) },
  { id: "10000000-0000-0000-0000-000000000004", proposedSlug: "aws-lambda-arn", proposedDomain: "internal_paths", proposedLayer: "regex", proposedRule: "ARN de funcion Lambda de produccion expuesto en el prompt", proposedPattern: "arn:aws:lambda:[a-z0-9\\-]+:\\d{12}:function:[A-Za-z0-9_\\-:]+", proposedAction: "WARN", proposedSeverity: "medium", matchCount: 4, examples: [{ traceId: "tr-log-007", promptRedacted: "El ARN de la funcion es arn:aws:lambda:us-east-1:...", createdAt: ago(6, 5).toISOString() }], status: "accepted", createdAt: ago(9, 3), decidedAt: ago(7, 10) },
  { id: "10000000-0000-0000-0000-000000000005", proposedSlug: "any-number-sequence", proposedDomain: "pii", proposedLayer: "regex", proposedRule: "Detectar cualquier secuencia de 8 digitos como posible DNI", proposedPattern: "\\b\\d{8}\\b", proposedAction: "BLOCK", proposedSeverity: "high", matchCount: 47, examples: [], status: "rejected", rejectReason: "Demasiados falsos positivos: matchea numeros de version, fechas (20240101) y otros datos sin relacion con DNI.", createdAt: ago(14, 5), decidedAt: ago(13, 9) },
  { id: "10000000-0000-0000-0000-000000000006", proposedSlug: "external-api-credentials-in-prompt", proposedDomain: "credentials", proposedLayer: "nl", proposedRule: "Credenciales de APIs externas (Stripe, Twilio, SendGrid) compartidas en el contexto del prompt", proposedAction: "BLOCK", proposedSeverity: "high", matchCount: 2, examples: [], status: "rejected", rejectReason: "El patron regex de 'hardcoded-secret-env' ya cubre estos casos con menor overhead. Duplicado innecesario.", createdAt: ago(6, 11), decidedAt: ago(5, 8) },
];

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST() {
  const orgId = process.env.DEMO_ORG_ID ?? "demo";

  try {
    // 1. Org (upsert)
    await prisma.organization.upsert({
      where: { id: orgId },
      update: { name: ORG.name, upstreamApiKeyRef: ORG.upstreamApiKeyRef },
      create: { ...ORG, id: orgId },
    });

    // 2. Member (upsert)
    await prisma.member.upsert({
      where: { orgId_email: { orgId, email: MEMBER.email } },
      update: {},
      create: { ...MEMBER, orgId },
    });

    // 3. Policies (upsert by org+slug)
    let policiesCount = 0;
    for (const p of POLICIES) {
      await prisma.policy.upsert({
        where: { orgId_slug: { orgId, slug: p.slug } },
        update: {
          domain: p.domain,
          layer: p.layer,
          rule: p.rule,
          pattern: p.pattern ?? null,
          matchConfig: p.matchConfig === undefined ? undefined : asJson(p.matchConfig),
          defaultAction: p.defaultAction,
          severity: p.severity,
          isActive: true,
        },
        create: {
          orgId,
          slug: p.slug,
          domain: p.domain,
          layer: p.layer,
          rule: p.rule,
          pattern: p.pattern ?? null,
          matchConfig: p.matchConfig === undefined ? undefined : asJson(p.matchConfig),
          defaultAction: p.defaultAction,
          severity: p.severity,
          source: "seed",
          isActive: true,
        },
      });
      policiesCount++;
    }

    // 4. Interactions (skip if trace_id exists)
    let interactionsCount = 0;
    for (const i of INTERACTIONS) {
      const tid = `${orgId}:${i.traceId}`;
      const exists = await prisma.interaction.findUnique({ where: { traceId: tid } });
      if (!exists) {
        await prisma.interaction.create({
          data: {
            traceId: tid,
            orgId,
            requestModel: i.requestModel,
            prompt: i.prompt,
            action: i.action,
            reason: i.reason,
            policyHits: asJson(i.policyHits),
            latencyTotalMs: i.latencyTotalMs,
            latencyByLayer: asJson(i.latencyByLayer),
            upstreamStatus: i.upstreamStatus,
            createdAt: i.createdAt,
          },
        });
        interactionsCount++;
      }
    }

    // 5. Rule Suggestions (skip if org+slug exists)
    let suggestionsCount = 0;
    for (const s of SUGGESTIONS) {
      const existing = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM rule_suggestions
        WHERE org_id = ${orgId} AND proposed_slug = ${s.proposedSlug}
        LIMIT 1
      `;
      if (existing.length === 0) {
        await prisma.ruleSuggestion.create({
          data: {
            id: s.id,
            orgId,
            proposedSlug: s.proposedSlug,
            proposedDomain: s.proposedDomain,
            proposedLayer: s.proposedLayer,
            proposedRule: s.proposedRule,
            proposedPattern: s.proposedPattern ?? null,
            proposedMatchConfig:
              s.proposedMatchConfig === undefined ? undefined : asJson(s.proposedMatchConfig),
            proposedAction: s.proposedAction,
            proposedSeverity: s.proposedSeverity,
            matchCount: s.matchCount,
            examples: asJson(s.examples),
            status: s.status,
            rejectReason: s.rejectReason ?? null,
            createdAt: s.createdAt,
            decidedAt: s.decidedAt ?? null,
          },
        });
        suggestionsCount++;
      }
    }

    return NextResponse.json({
      ok: true,
      orgId,
      seeded: {
        policies: policiesCount,
        interactions: interactionsCount,
        suggestions: suggestionsCount,
      },
      message: `Seed completado para org_id=${orgId}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
