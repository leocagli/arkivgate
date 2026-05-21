/**
 * Demo seed for ArkivGate admin.
 * Uses `pg` directly (already installed) â€” no Prisma adapter needed.
 * Run: node prisma/seed.mjs
 *
 * Loads DATABASE_URL from .env.local then .env (same priority as Next.js).
 */

import { createRequire } from "module";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// â”€â”€ .env loader (manual, no deps) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function loadEnv(path) {
  if (!existsSync(path)) return;
  const lines = readFileSync(path, "utf-8").split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = val;
  }
}

const webDir = join(__dirname, "..");
loadEnv(join(webDir, ".env.local"));
loadEnv(join(webDir, ".env"));

// â”€â”€ pg client â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const require = createRequire(import.meta.url);
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = { query: (sql, params) => pool.query(sql, params) };

// â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function uuid() {
  return crypto.randomUUID();
}

function daysAgo(n, jitterHours = 0) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(d.getHours() - jitterHours);
  return d;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// â”€â”€ CLI args â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function parseArgs(argv) {
  const out = { policiesOnly: false, orgId: null };
  for (const a of argv) {
    if (a === "--policies-only") out.policiesOnly = true;
    else if (a.startsWith("--org-id=")) out.orgId = a.slice("--org-id=".length);
  }
  return out;
}

const CLI = parseArgs(process.argv.slice(2));

// â”€â”€ data definitions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ORG_ID = CLI.orgId ?? "demo";

const POLICIES = [
  // â”€â”€ Regex / credentials â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    slug: "aws-access-key",
    domain: "credentials",
    layer: "regex",
    rule: "Detecta claves de acceso AWS (AKIAâ€¦) en cualquier mensaje.",
    pattern: "AKIA[0-9A-Z]{16}",
    defaultAction: "BLOCK",
    severity: "high",
  },
  {
    slug: "generic-api-key",
    domain: "credentials",
    layer: "regex",
    rule: "Detecta patrones genÃ©ricos de API keys (sk-â€¦ / token: â€¦).",
    pattern: "(sk-[a-zA-Z0-9]{32,}|api[_-]?key[^\\S\\r\\n]*[:=][^\\S\\r\\n]*['\"]?[a-zA-Z0-9/_\\-]{20,})",
    defaultAction: "REDACT",
    severity: "high",
  },
  // â”€â”€ Regex / PII â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    slug: "email-pii",
    domain: "pii",
    layer: "regex",
    rule: "Detecta direcciones de correo electrÃ³nico en prompts.",
    pattern: "[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}",
    defaultAction: "REDACT",
    severity: "medium",
  },
  {
    slug: "cuil-cuit",
    domain: "pii",
    layer: "regex",
    rule: "Detecta CUIL/CUIT argentinos (XX-XXXXXXXX-X).",
    pattern: "\\b(20|23|24|27|30|33|34)-?\\d{8}-?\\d\\b",
    defaultAction: "REDACT",
    severity: "medium",
  },
  {
    slug: "phone-number-ar",
    domain: "pii",
    layer: "regex",
    rule: "Detecta nÃºmeros de telÃ©fono argentinos en formato +54 o 011.",
    pattern: "(\\+54|0?11|0?[2-9]\\d{2,3})[\\s\\-]?\\d{4}[\\s\\-]?\\d{4}",
    defaultAction: "REDACT",
    severity: "medium",
  },
  // â”€â”€ Pattern / internal paths â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    slug: "env-files",
    domain: "internal_paths",
    layer: "pattern",
    rule: "Bloquea archivos de configuraciÃ³n de entorno que pueden contener secrets.",
    pattern: null,
    matchConfig: { extensions: [".env", ".env.local", ".env.production"] },
    defaultAction: "BLOCK",
    severity: "high",
  },
  {
    slug: "private-keys",
    domain: "internal_paths",
    layer: "pattern",
    rule: "Bloquea archivos de clave privada (PEM, p12, pfx).",
    pattern: null,
    matchConfig: { extensions: [".pem", ".p12", ".pfx", ".key"] },
    defaultAction: "BLOCK",
    severity: "high",
  },
  // â”€â”€ NL / business_policy â€” estÃ¡ndares corporativos de Acme Corp â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    slug: "competitor-mention",
    domain: "business_policy",
    layer: "nl",
    rule: "El usuario menciona o pide comparar con competidores directos (OpenAI, Cursor, Copilot, GitHub).",
    pattern: null,
    defaultAction: "WARN",
    severity: "medium",
  },
  {
    slug: "roadmap-disclosure",
    domain: "business_policy",
    layer: "nl",
    rule: "El prompt revela o pregunta sobre el roadmap de producto, features no lanzadas o planes estratÃ©gicos internos.",
    pattern: null,
    defaultAction: "BLOCK",
    severity: "high",
  },
  {
    slug: "direct-production-access",
    domain: "business_policy",
    layer: "nl",
    rule: "El objetivo de Acme Corp es que ninguna modificaciÃ³n llegue a producciÃ³n sin pasar por el proceso formal de change management. Los empleados que soliciten asistencia para ejecutar comandos, modificar datos o deployar directamente en prod sin ticket aprobado deben ser bloqueados.",
    pattern: null,
    defaultAction: "BLOCK",
    severity: "high",
  },
  {
    slug: "financial-projections",
    domain: "business_policy",
    layer: "nl",
    rule: "El objetivo de Acme Corp es mantener absoluta confidencialidad sobre su situaciÃ³n financiera. EstÃ¡ prohibido mencionar en prompts mÃ©tricas como ARR, MRR, runway, valuaciÃ³n, proyecciones de revenue, cap table o cualquier dato financiero no pÃºblico de la compaÃ±Ã­a.",
    pattern: null,
    defaultAction: "BLOCK",
    severity: "high",
  },
  {
    slug: "skip-code-review",
    domain: "business_policy",
    layer: "nl",
    rule: "Los empleados que pregunten cÃ³mo saltear, bypassear o evitar el proceso de code review establecido en el Engineering Handbook de Acme Corp deben ser advertidos. Todo cambio a main requiere al menos una aprobaciÃ³n de un peer.",
    pattern: null,
    defaultAction: "WARN",
    severity: "medium",
  },
  {
    slug: "pii-retention-violation",
    domain: "business_policy",
    layer: "nl",
    rule: "El objetivo de Acme Corp es cumplir con LGPD y Habeas Data. Toda funciÃ³n que persista datos personales de usuarios debe incluir una polÃ­tica de retenciÃ³n (TTL mÃ¡ximo 90 dÃ­as). Los devs que consulten sobre almacenar PII indefinidamente deben ser advertidos.",
    pattern: null,
    defaultAction: "WARN",
    severity: "medium",
  },
  // â”€â”€ NL / code â€” estÃ¡ndares de ingenierÃ­a de Acme Corp â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    slug: "hardcoded-credentials",
    domain: "code",
    layer: "nl",
    rule: "El cÃ³digo generado contiene credenciales hardcodeadas, tokens o contraseÃ±as en texto plano.",
    pattern: null,
    defaultAction: "BLOCK",
    severity: "high",
  },
  {
    slug: "code-must-be-english",
    domain: "code",
    layer: "nl",
    rule: "El objetivo de Acme Corp es mantener una base de cÃ³digo legible para equipos distribuidos. Todas las funciones, variables, comentarios y mensajes de error deben estar en inglÃ©s. Los devs que generen cÃ³digo con identificadores o comentarios en espaÃ±ol deben ser advertidos.",
    pattern: null,
    defaultAction: "WARN",
    severity: "low",
  },
  {
    slug: "async-without-timeout",
    domain: "code",
    layer: "nl",
    rule: "El objetivo de Acme Corp es garantizar la resiliencia de sus servicios. Toda funciÃ³n asÃ­ncrona que llame a un servicio externo o base de datos debe incluir un timeout configurado explÃ­citamente. Las funciones sin timeout violan el estÃ¡ndar de ingenierÃ­a y deben generar una advertencia.",
    pattern: null,
    defaultAction: "WARN",
    severity: "medium",
  },
  {
    slug: "informal-language-code",
    domain: "code",
    layer: "nl",
    rule: "Los empleados que utilicen palabras malsonantes, ofensivas o expresiones informales (wtf, mierda, cagada, hack sucio, no sÃ© por quÃ© funciona) en comentarios de cÃ³digo, mensajes de commit o nombres de variables deben ser advertidos sobre el estÃ¡ndar de comunicaciÃ³n profesional de Acme Corp.",
    pattern: null,
    defaultAction: "WARN",
    severity: "low",
  },
];

// â”€â”€ realistic interaction scenarios â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SCENARIOS = [
  // â”€â”€ BLOCK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // aws-access-key â€” regex hit
  {
    action: "BLOCK",
    reason: "Clave de acceso AWS detectada en el prompt. Request bloqueado.",
    policyHits: [{ layer: "regex", slug: "aws-access-key" }],
    promptTemplate:
      "Tengo este error al deployar en Lambda. Mi config:\nAWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE\nAWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY\nÂ¿Por quÃ© falla el rol?",
    latency: [18, 45],
  },
  {
    action: "BLOCK",
    reason: "Clave de acceso AWS detectada en el prompt. Request bloqueado.",
    policyHits: [{ layer: "regex", slug: "aws-access-key" }],
    promptTemplate:
      "El deploy de ECS falla con AccessDenied. Credenciales actuales: AKIAJ5ZFAKEKEY9DEMO1\nSecret: fakeS3cr3tKey/DEMO+456+XYZ99. Â¿QuÃ© IAM policy falta?",
    latency: [16, 42],
  },

  // roadmap-disclosure â€” NL hit
  {
    action: "BLOCK",
    reason: "El prompt expone features de roadmap no lanzadas. Request bloqueado.",
    policyHits: [{ layer: "nl", slug: "roadmap-disclosure" }],
    promptTemplate:
      "RedactÃ¡ el PRD para la integraciÃ³n de pagos con Mercado Pago que vamos a lanzar en Q3. IncluÃ­ los endpoints que aÃºn no estÃ¡n en producciÃ³n.",
    latency: [120, 220],
  },
  {
    action: "BLOCK",
    reason: "DivulgaciÃ³n de feature no anunciada detectada. Request bloqueado.",
    policyHits: [{ layer: "nl", slug: "roadmap-disclosure" }],
    promptTemplate:
      "Ayudame a escribir el anuncio del nuevo mÃ³dulo de IA generativa que vamos a revelar en el evento de octubre. El nombre en clave es Proyecto CÃ³ndor y todavÃ­a es confidencial.",
    latency: [130, 240],
  },

  // hardcoded-credentials â€” NL hit
  {
    action: "BLOCK",
    reason: "Solicitud de cÃ³digo con credenciales hardcodeadas detectada. Request bloqueado.",
    policyHits: [{ layer: "nl", slug: "hardcoded-credentials" }],
    promptTemplate:
      "EscribÃ­ un script de Python para conectarse a nuestra base de datos. User: admin, password: Acm3S3cur3!2024, host: db.acme.internal.",
    latency: [110, 200],
  },
  {
    action: "BLOCK",
    reason: "CÃ³digo con password en texto plano detectado. Request bloqueado.",
    policyHits: [{ layer: "nl", slug: "hardcoded-credentials" }],
    promptTemplate:
      "CompletÃ¡ este snippet de Node.js para conectar a Redis:\nconst client = createClient({ password: 'r3d1s$ecr3t2024', host: 'cache.internal' })",
    latency: [105, 195],
  },

  // direct-production-access â€” NL hit (nueva policy)
  {
    action: "BLOCK",
    reason: "Solicitud de acceso directo a producciÃ³n sin proceso de change management. Request bloqueado.",
    policyHits: [{ layer: "nl", slug: "direct-production-access" }],
    promptTemplate:
      "Necesito modificar directamente la tabla users en prod para corregir los registros del evento de ayer. Â¿CÃ³mo me conecto al Postgres de producciÃ³n y ejecuto el UPDATE sin pasar por el proceso de change management?",
    latency: [125, 230],
  },
  {
    action: "BLOCK",
    reason: "Intento de deploy directo a producciÃ³n sin ticket aprobado. Request bloqueado.",
    policyHits: [{ layer: "nl", slug: "direct-production-access" }],
    promptTemplate:
      "Es urgente, el cliente estÃ¡ caÃ­do. Â¿CÃ³mo hago kubectl apply directo en el cluster de prod sin esperar la aprobaciÃ³n del change board? El ticket tarda 2 horas.",
    latency: [118, 215],
  },

  // financial-projections â€” NL hit (nueva policy)
  {
    action: "BLOCK",
    reason: "Datos financieros confidenciales de la empresa detectados. Request bloqueado.",
    policyHits: [{ layer: "nl", slug: "financial-projections" }],
    promptTemplate:
      "Preparame la presentaciÃ³n del board de inversores para el jueves. ARR actual: $2.1M, proyectamos llegar a $5M para Q4 y tenemos 18 meses de runway. Â¿CÃ³mo ordeno los slides?",
    latency: [135, 245],
  },
  {
    action: "BLOCK",
    reason: "MÃ©tricas financieras no pÃºblicas detectadas. Request bloqueado.",
    policyHits: [{ layer: "nl", slug: "financial-projections" }],
    promptTemplate:
      "Ayudame a calcular la valuaciÃ³n pre-money para la ronda Serie A. Tenemos $180K MRR, churn del 2% y queremos pedir un mÃºltiplo de 8x ARR.",
    latency: [128, 235],
  },

  // â”€â”€ REDACT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // email-pii â€” regex hit
  {
    action: "REDACT",
    reason: "DirecciÃ³n de email redactada del prompt.",
    policyHits: [{ layer: "regex", slug: "email-pii" }],
    promptTemplate:
      "El cliente [REDACTED] reportÃ³ un bug en el checkout. Â¿CÃ³mo lo debuggeo?",
    latency: [12, 30],
  },
  {
    action: "REDACT",
    reason: "DirecciÃ³n de email redactada del prompt.",
    policyHits: [{ layer: "regex", slug: "email-pii" }],
    promptTemplate:
      "Â¿Por quÃ© falla la invitaciÃ³n que le mandÃ© a [REDACTED]? El link expira antes de que abra el mail.",
    latency: [11, 28],
  },
  {
    action: "REDACT",
    reason: "DirecciÃ³n de email redactada del prompt.",
    policyHits: [{ layer: "regex", slug: "email-pii" }],
    promptTemplate:
      "Necesito filtrar todos los registros del usuario [REDACTED] para el reporte de auditorÃ­a. Â¿CÃ³mo armo la query?",
    latency: [10, 26],
  },

  // generic-api-key â€” regex hit
  {
    action: "REDACT",
    reason: "API key detectada y redactada. El prompt continÃºa sin el secret.",
    policyHits: [{ layer: "regex", slug: "generic-api-key" }],
    promptTemplate:
      "Â¿Por quÃ© falla este fetch? Headers: { Authorization: 'Bearer [REDACTED]' }. El endpoint devuelve 401.",
    latency: [14, 35],
  },
  {
    action: "REDACT",
    reason: "Token de API redactado del prompt.",
    policyHits: [{ layer: "regex", slug: "generic-api-key" }],
    promptTemplate:
      "IntegrÃ© el webhook de Stripe pero sigo recibiendo signature mismatch. Mi endpoint secret es [REDACTED]. Â¿QuÃ© puede estar fallando?",
    latency: [13, 32],
  },

  // cuil-cuit â€” regex hit
  {
    action: "REDACT",
    reason: "CUIT/CUIL argentino redactado del prompt.",
    policyHits: [{ layer: "regex", slug: "cuil-cuit" }],
    promptTemplate:
      "GenerÃ¡ un certificado para la empresa con CUIT [REDACTED]. Necesito el XML del AFIP.",
    latency: [10, 28],
  },
  {
    action: "REDACT",
    reason: "CUIL de empleado redactado del prompt.",
    policyHits: [{ layer: "regex", slug: "cuil-cuit" }],
    promptTemplate:
      "ProcesÃ¡ el alta del empleado en el sistema. Su CUIL es [REDACTED] y su fecha de ingreso fue el 1 de marzo.",
    latency: [9, 25],
  },

  // phone-number-ar â€” regex hit (nueva policy)
  {
    action: "REDACT",
    reason: "NÃºmero de telÃ©fono argentino redactado del prompt.",
    policyHits: [{ layer: "regex", slug: "phone-number-ar" }],
    promptTemplate:
      "El cliente llamÃ³ al [REDACTED] para reportar el bug de pagos. Â¿CÃ³mo le mando el fix por WhatsApp?",
    latency: [11, 27],
  },
  {
    action: "REDACT",
    reason: "NÃºmero de telÃ©fono redactado del prompt.",
    policyHits: [{ layer: "regex", slug: "phone-number-ar" }],
    promptTemplate:
      "ActualizÃ¡ el campo phone del usuario id=4521 con el nÃºmero [REDACTED]. Â¿CÃ³mo hago el UPDATE con validaciÃ³n de formato?",
    latency: [10, 24],
  },

  // â”€â”€ WARN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // competitor-mention â€” NL hit
  {
    action: "WARN",
    reason: "MenciÃ³n de herramienta competidora detectada. Request permitido con advertencia.",
    policyHits: [{ layer: "nl", slug: "competitor-mention" }],
    promptTemplate:
      "Â¿CÃ³mo se compara nuestra latencia con la de Cursor? Â¿DeberÃ­amos migrar a GitHub Copilot para los devs?",
    latency: [105, 190],
  },
  {
    action: "WARN",
    reason: "ComparaciÃ³n con competidor externo detectada. Request permitido con advertencia.",
    policyHits: [{ layer: "nl", slug: "competitor-mention" }],
    promptTemplate:
      "OpenAI acaba de lanzar Codex 2. Â¿QuÃ© ventajas tenemos nosotros respecto a ellos para vender a enterprise?",
    latency: [118, 210],
  },
  {
    action: "WARN",
    reason: "AnÃ¡lisis comparativo con competidor detectado. Request permitido con advertencia.",
    policyHits: [{ layer: "nl", slug: "competitor-mention" }],
    promptTemplate:
      "Â¿QuÃ© features tiene Cursor que nosotros no tengamos? Quiero armar un competitive analysis para el equipo de producto antes del sprint planning.",
    latency: [112, 205],
  },
  {
    action: "WARN",
    reason: "MenciÃ³n de herramienta competidora en contexto de adopciÃ³n. Request permitido con advertencia.",
    policyHits: [{ layer: "nl", slug: "competitor-mention" }],
    promptTemplate:
      "El equipo de mobile quiere probar GitHub Copilot porque dicen que soporta mejor Swift. Â¿CÃ³mo evaluamos si cambiamos?",
    latency: [108, 198],
  },

  // informal-language-code â€” NL hit (nueva policy)
  {
    action: "WARN",
    reason: "Lenguaje informal detectado en cÃ³digo. Request permitido con advertencia.",
    policyHits: [{ layer: "nl", slug: "informal-language-code" }],
    promptTemplate:
      "// wtf por quÃ© esto no compila\nfunction calcTotal(items) {\n  // no sÃ© por quÃ© funciona pero funciona\n  return items.reduce((a, b) => a + b.price, 0)\n}\nÂ¿QuÃ© estÃ¡ mal acÃ¡?",
    latency: [95, 180],
  },
  {
    action: "WARN",
    reason: "Expresiones informales en comentarios de cÃ³digo detectadas. Request permitido con advertencia.",
    policyHits: [{ layer: "nl", slug: "informal-language-code" }],
    promptTemplate:
      "Tengo este hack de mierda que dejÃ³ el dev anterior y ahora hay que mantenerlo. Â¿CÃ³mo lo refactorizo sin romper nada?\n\n// HACK TEMPORAL (lleva 2 aÃ±os acÃ¡)\nif (user.role === 'admin' || user.id === 42) { ... }",
    latency: [100, 185],
  },
  {
    action: "WARN",
    reason: "Lenguaje inapropiado en nombre de variable detectado. Request permitido con advertencia.",
    policyHits: [{ layer: "nl", slug: "informal-language-code" }],
    promptTemplate:
      "La funciÃ³n `fixCagadaDelMiercoles` estÃ¡ fallando en staging. Es la que parsea los webhooks de Stripe. Â¿Le cambio el nombre o la reescribo?",
    latency: [92, 175],
  },

  // skip-code-review â€” NL hit (nueva policy)
  {
    action: "WARN",
    reason: "Intento de saltear el proceso de code review detectado. Request permitido con advertencia.",
    policyHits: [{ layer: "nl", slug: "skip-code-review" }],
    promptTemplate:
      "Â¿CÃ³mo pusheo directo a main sin que salte la protecciÃ³n de la branch? Es urgente, hay un bug en prod y el reviewer no estÃ¡ disponible.",
    latency: [98, 185],
  },
  {
    action: "WARN",
    reason: "Consulta para evadir el proceso de review detectada. Request permitido con advertencia.",
    policyHits: [{ layer: "nl", slug: "skip-code-review" }],
    promptTemplate:
      "Â¿Puedo hacer un force push a la rama release/2.4 para saltear el pipeline de CI que estÃ¡ tardando 45 minutos? El cliente estÃ¡ esperando el hotfix.",
    latency: [102, 190],
  },

  // pii-retention-violation â€” NL hit (nueva policy)
  {
    action: "WARN",
    reason: "Consulta sobre retenciÃ³n indefinida de PII detectada. Request permitido con advertencia.",
    policyHits: [{ layer: "nl", slug: "pii-retention-violation" }],
    promptTemplate:
      "Guardamos todos los logs con nombre, email e IP de usuarios desde hace 4 aÃ±os sin borrar nada. Las queries se ponen lentas. Â¿CÃ³mo indexo mejor en vez de borrar?",
    latency: [108, 195],
  },
  {
    action: "WARN",
    reason: "Almacenamiento indefinido de datos personales detectado. Request permitido con advertencia.",
    policyHits: [{ layer: "nl", slug: "pii-retention-violation" }],
    promptTemplate:
      "Â¿CÃ³mo diseÃ±o la tabla de historial de sesiones? Quiero guardar IP, user agent y timestamp de cada login de por vida para tener trazabilidad completa.",
    latency: [105, 192],
  },

  // code-must-be-english â€” NL hit (nueva policy)
  {
    action: "WARN",
    reason: "CÃ³digo con identificadores en espaÃ±ol detectado. Request permitido con advertencia.",
    policyHits: [{ layer: "nl", slug: "code-must-be-english" }],
    promptTemplate:
      "function calcularDescuento(monto, porcentaje) {\n  // calcula el descuento final con validaciÃ³n\n  if (porcentaje > 100) throw new Error('porcentaje invÃ¡lido')\n  return monto * (porcentaje / 100)\n}\nÂ¿Por quÃ© falla con decimales grandes?",
    latency: [96, 180],
  },
  {
    action: "WARN",
    reason: "Variables y comentarios en espaÃ±ol en el cÃ³digo detectados. Request permitido con advertencia.",
    policyHits: [{ layer: "nl", slug: "code-must-be-english" }],
    promptTemplate:
      "RevisÃ¡ este mÃ³dulo de facturaciÃ³n:\nconst obtenerFactura = async (idCliente) => {\n  // busca la factura del cliente en la base de datos\n  const resultado = await db.facturas.findOne({ cliente: idCliente })\n  return resultado\n}",
    latency: [99, 183],
  },

  // async-without-timeout â€” NL hit (nueva policy)
  {
    action: "WARN",
    reason: "FunciÃ³n asÃ­ncrona sin timeout configurado detectada. Request permitido con advertencia.",
    policyHits: [{ layer: "nl", slug: "async-without-timeout" }],
    promptTemplate:
      "Â¿CÃ³mo optimizo este fetch a la API de terceros?\nconst data = await fetch('https://api.proveedor.com/facturas')\nA veces tarda mucho y no sÃ© por quÃ©.",
    latency: [103, 188],
  },
  {
    action: "WARN",
    reason: "Llamada a servicio externo sin timeout ni circuit breaker detectada. Request permitido con advertencia.",
    policyHits: [{ layer: "nl", slug: "async-without-timeout" }],
    promptTemplate:
      "IntegrÃ© la API de AFIP para validar CUITs. A veces la API no responde y mi servicio se queda colgado. Â¿CÃ³mo lo manejo?\nawait afip.validateCuit(cuit) // sin timeout",
    latency: [106, 193],
  },

  // â”€â”€ LOG â€” normal benign requests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    action: "LOG",
    reason: "Request procesado sin violaciones de polÃ­tica.",
    policyHits: [],
    promptTemplate: "Explicame la diferencia entre `useEffect` y `useLayoutEffect` en React.",
    latency: [8, 25],
  },
  {
    action: "LOG",
    reason: "Request procesado sin violaciones de polÃ­tica.",
    policyHits: [],
    promptTemplate: "Â¿CÃ³mo ordeno un array de objetos por fecha en JavaScript? Dame un ejemplo.",
    latency: [7, 22],
  },
  {
    action: "LOG",
    reason: "Request procesado sin violaciones de polÃ­tica.",
    policyHits: [],
    promptTemplate: "EscribÃ­ un test unitario para esta funciÃ³n de validaciÃ³n de email con Jest.",
    latency: [9, 26],
  },
  {
    action: "LOG",
    reason: "Request procesado sin violaciones de polÃ­tica.",
    policyHits: [],
    promptTemplate: "Â¿CuÃ¡l es la diferencia entre `async/await` y Promises en JavaScript?",
    latency: [6, 20],
  },
  {
    action: "LOG",
    reason: "Request procesado sin violaciones de polÃ­tica.",
    policyHits: [],
    promptTemplate: "Ayudame a refactorizar este componente React para que use hooks en vez de clases.",
    latency: [11, 30],
  },
  {
    action: "LOG",
    reason: "Request procesado sin violaciones de polÃ­tica.",
    policyHits: [],
    promptTemplate: "Â¿CÃ³mo implemento paginaciÃ³n con cursor en GraphQL? Necesito que soporte filtros.",
    latency: [9, 27],
  },
  {
    action: "LOG",
    reason: "Request procesado sin violaciones de polÃ­tica.",
    policyHits: [],
    promptTemplate: "Explicame el patrÃ³n Repository en TypeScript con un ejemplo de un CRUD bÃ¡sico.",
    latency: [8, 24],
  },

  // LOG â€” client name mentions (pattern for AI Suggestor to detect)
  {
    action: "LOG",
    reason: "Request procesado sin violaciones.",
    policyHits: [],
    promptTemplate:
      "Nuestro cliente Banco Galicia reportÃ³ un error en el mÃ³dulo de liquidaciones. Â¿CÃ³mo debuggeo esto?",
    latency: [7, 22],
    weight: 4,
  },
  {
    action: "LOG",
    reason: "Request procesado sin violaciones.",
    policyHits: [],
    promptTemplate:
      "Preparame el resumen del sprint para Claro Argentina. Esta semana entregamos la integraciÃ³n con su sistema de facturaciÃ³n.",
    latency: [8, 24],
    weight: 4,
  },
  {
    action: "LOG",
    reason: "Request procesado sin violaciones.",
    policyHits: [],
    promptTemplate:
      "Â¿CÃ³mo optimizo esta query para el cliente Mercado Libre? EstÃ¡n teniendo timeouts en su mÃ³dulo de pagos.",
    latency: [9, 25],
    weight: 4,
  },
  {
    action: "LOG",
    reason: "Request procesado sin violaciones.",
    policyHits: [],
    promptTemplate:
      "El equipo de YPF pregunta si podemos integrar con su API interna. Â¿QuÃ© informaciÃ³n necesitamos pedirles?",
    latency: [7, 20],
    weight: 4,
  },
  {
    action: "LOG",
    reason: "Request procesado sin violaciones.",
    policyHits: [],
    promptTemplate:
      "Telecom Argentina necesita el reporte de disponibilidad del Ãºltimo mes en formato PDF. Â¿CÃ³mo genero el grÃ¡fico de uptime?",
    latency: [8, 23],
    weight: 4,
  },

  // LOG â€” internal host mentions (pattern for AI Suggestor to detect)
  {
    action: "LOG",
    reason: "Request procesado sin violaciones.",
    policyHits: [],
    promptTemplate:
      "Â¿Por quÃ© falla el healthcheck contra db-prod-01.internal? El servicio de pagos no puede conectarse.",
    latency: [8, 23],
    weight: 4,
  },
  {
    action: "LOG",
    reason: "Request procesado sin violaciones.",
    policyHits: [],
    promptTemplate:
      "Necesito conectarme a redis://cache.internal:6379 desde el servicio de notificaciones. Â¿CÃ³mo configuro el pool?",
    latency: [6, 18],
    weight: 4,
  },
  {
    action: "LOG",
    reason: "Request procesado sin violaciones.",
    policyHits: [],
    promptTemplate:
      "El microservicio auth.internal:8080 devuelve 502 intermitente. Â¿Puede ser un timeout del load balancer?",
    latency: [9, 25],
    weight: 4,
  },
  {
    action: "LOG",
    reason: "Request procesado sin violaciones.",
    policyHits: [],
    promptTemplate:
      "Â¿CÃ³mo configuro el service discovery para que api-gateway.internal encuentre automÃ¡ticamente los nuevos pods?",
    latency: [8, 22],
    weight: 4,
  },

  // LOG â€” salary/compensation mentions (pattern for AI Suggestor to detect)
  {
    action: "LOG",
    reason: "Request procesado sin violaciones.",
    policyHits: [],
    promptTemplate:
      "RedactÃ¡ el email de oferta para el senior backend. El sueldo acordado es $5000 USD/mes + equity. Â¿CÃ³mo lo presento bien?",
    latency: [8, 22],
    weight: 4,
  },
  {
    action: "LOG",
    reason: "Request procesado sin violaciones.",
    policyHits: [],
    promptTemplate:
      "Â¿CÃ³mo armo una planilla de bandas salariales para engineering? Tenemos juniors a $1500, mids a $3000, seniors a $5000 USD.",
    latency: [7, 20],
    weight: 4,
  },
  {
    action: "LOG",
    reason: "Request procesado sin violaciones.",
    policyHits: [],
    promptTemplate:
      "El candidato rechazÃ³ la oferta de $4200 USD y pide $4800. Â¿CÃ³mo redacto el contra-oferta de forma convincente?",
    latency: [9, 24],
    weight: 4,
  },
];

const RULE_SUGGESTIONS = [
  {
    proposedSlug: "internal-ip-range",
    proposedDomain: "internal_paths",
    proposedLayer: "regex",
    proposedRule: "Detecta referencias a rangos IP internos (10.x, 192.168.x, 172.16-31.x) en prompts.",
    proposedPattern: "\\b(10\\.\\d{1,3}|192\\.168|172\\.(1[6-9]|2[0-9]|3[01]))\\.\\d{1,3}\\.\\d{1,3}\\b",
    proposedAction: "WARN",
    proposedSeverity: "medium",
    matchCount: 47,
    examples: [
      {
        traceId: "trace-ex-001",
        promptRedacted: "Â¿Por quÃ© no llega el ping a 10.0.1.45 desde el servicio de pagos?",
        createdAt: daysAgo(2).toISOString(),
      },
      {
        traceId: "trace-ex-002",
        promptRedacted: "El servidor en 192.168.1.100 no responde al healthcheck.",
        createdAt: daysAgo(3).toISOString(),
      },
    ],
    sourceHint: null,
    status: "pending",
  },
  {
    proposedSlug: "database-connection-string",
    proposedDomain: "credentials",
    proposedLayer: "regex",
    proposedRule: "Detecta connection strings de base de datos con credenciales embebidas.",
    proposedPattern: "(postgres|mysql|mongodb|redis):\\/\\/[^:]+:[^@]+@[\\w.\\-]+",
    proposedAction: "BLOCK",
    proposedSeverity: "high",
    matchCount: 31,
    examples: [
      {
        traceId: "trace-ex-003",
        promptRedacted: "Â¿Por quÃ© falla la conexiÃ³n? DSN: postgres://admin:s3cr3t@db.acme.internal:5432/prod",
        createdAt: daysAgo(1).toISOString(),
      },
    ],
    sourceHint: null,
    status: "pending",
  },
  {
    proposedSlug: "salary-disclosure",
    proposedDomain: "pii",
    proposedLayer: "nl",
    proposedRule: "El prompt menciona salarios especÃ­ficos, compensaciones o bandas salariales de empleados.",
    proposedPattern: null,
    proposedAction: "BLOCK",
    proposedSeverity: "high",
    matchCount: 12,
    examples: [
      {
        traceId: "trace-ex-004",
        promptRedacted: "RedactÃ¡ el email de oferta para el candidato. El sueldo acordado es $4.500 USD/mes.",
        createdAt: daysAgo(4).toISOString(),
      },
    ],
    sourceHint: null,
    status: "accepted",
  },
  {
    proposedSlug: "m-and-a-information",
    proposedDomain: "business_policy",
    proposedLayer: "nl",
    proposedRule: "El usuario menciona adquisiciones, fusiones o due diligence de empresas no pÃºblicas.",
    proposedPattern: null,
    proposedAction: "BLOCK",
    proposedSeverity: "high",
    matchCount: 8,
    examples: [
      {
        traceId: "trace-ex-005",
        promptRedacted: "Ayudame a preparar el data room para la due diligence de la startup que estamos evaluando comprar.",
        createdAt: daysAgo(5).toISOString(),
      },
    ],
    sourceHint: "google_workspace",
    status: "pending",
  },
  {
    proposedSlug: "legal-privilege",
    proposedDomain: "business_policy",
    proposedLayer: "nl",
    proposedRule: "El prompt contiene comunicaciones privilegiadas con abogados o estrategia legal interna.",
    proposedPattern: null,
    proposedAction: "WARN",
    proposedSeverity: "medium",
    matchCount: 5,
    examples: [],
    sourceHint: null,
    status: "rejected",
    rejectReason: "Muy amplio â€” genera demasiados falsos positivos en contexto de contratos de proveedores.",
  },
];

// â”€â”€ main â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function main() {
  console.log("ðŸŒ± ArkivGate demo seed â€” empezando...\n");

  // 1. Truncate in FK-safe order
  console.log("ðŸ—‘ï¸  Limpiando tablas existentes...");
  await db.query(`
    TRUNCATE TABLE
      cli_device_codes,
      cli_tokens,
      rule_suggestions,
      interactions,
      policies,
      members,
      auth_verification_tokens,
      auth_sessions,
      auth_accounts,
      auth_users,
      organizations
    RESTART IDENTITY CASCADE
  `);
  console.log("   âœ“ tablas limpias\n");

  // 2. Organization
  console.log("ðŸ¢ Creando organizaciÃ³n demo...");
  await db.query(
    `INSERT INTO organizations (id, name, email_domain, created_at)
     VALUES ($1, $2, $3, NOW())`,
    [ORG_ID, "Acme Corp", "acme.com"],
  );
  console.log("   âœ“ org demo / Acme Corp\n");

  // 3. Admin member
  console.log("ðŸ‘¤ Creando member admin...");
  const memberId = uuid();
  await db.query(
    `INSERT INTO members (id, org_id, email, role, created_at)
     VALUES ($1, $2, $3, $4, NOW())`,
    [memberId, ORG_ID, "admin@acme.com", "admin"],
  );
  console.log("   âœ“ admin@acme.com\n");

  // 4. Policies
  console.log("ðŸ“‹ Insertando polÃ­ticas...");
  const policyIds = {};
  for (const p of POLICIES) {
    const id = uuid();
    policyIds[p.slug] = id;
    const matchConfig = p.matchConfig ? JSON.stringify(p.matchConfig) : null;
    await db.query(
      `INSERT INTO policies
         (id, org_id, slug, domain, layer, rule, pattern, match_config,
          default_action, severity, source, is_active, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,NOW(),NOW())`,
      [
        id, ORG_ID, p.slug, p.domain, p.layer, p.rule,
        p.pattern ?? null, matchConfig,
        p.defaultAction, p.severity, "seed", true,
      ],
    );
    console.log(`   âœ“ ${p.slug} [${p.layer}/${p.domain}]`);
  }
  console.log();

  // 5. Interactions â€” ~180 spread over 7 days
  console.log("ðŸ“¡ Generando interactions demo...");

  // Weight distribution per day: more recent = more traffic
  const dayWeights = [30, 28, 25, 22, 18, 15, 12]; // day 0 (today) to day 6
  const totalTarget = 180;
  const weightSum = dayWeights.reduce((a, b) => a + b, 0);

  // Action distribution targets (approximate)
  const actionWeights = { BLOCK: 15, REDACT: 25, WARN: 20, LOG: 40 };

  // Build weighted scenario lists: scenarios with a `weight` field are repeated
  // proportionally so they appear more often when picked randomly.
  function buildWeightedList(scenarios) {
    const result = [];
    for (const s of scenarios) {
      const w = s.weight ?? 1;
      for (let i = 0; i < w; i++) result.push(s);
    }
    return result;
  }

  const scenariosByAction = {
    BLOCK: buildWeightedList(SCENARIOS.filter((s) => s.action === "BLOCK")),
    REDACT: buildWeightedList(SCENARIOS.filter((s) => s.action === "REDACT")),
    WARN: buildWeightedList(SCENARIOS.filter((s) => s.action === "WARN")),
    LOG: buildWeightedList(SCENARIOS.filter((s) => s.action === "LOG")),
  };

  let count = 0;
  for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
    const countForDay = Math.round((dayWeights[dayIdx] / weightSum) * totalTarget);
    for (let i = 0; i < countForDay; i++) {
      // Pick action by weight
      const r = Math.random() * 100;
      let action;
      if (r < actionWeights.BLOCK) action = "BLOCK";
      else if (r < actionWeights.BLOCK + actionWeights.REDACT) action = "REDACT";
      else if (r < actionWeights.BLOCK + actionWeights.REDACT + actionWeights.WARN) action = "WARN";
      else action = "LOG";

      const scenario = pick(scenariosByAction[action]);
      const id = uuid();
      const traceId = `trace-${id.slice(0, 8)}`;
      const latencyMs = randomInt(scenario.latency[0], scenario.latency[1]);
      // Add upstream latency for non-blocked requests
      const upstreamMs = action !== "BLOCK" ? randomInt(80, 300) : null;
      const totalMs = upstreamMs ? latencyMs + upstreamMs : latencyMs;

      // Timestamp: random within the day, slightly clustered in business hours
      const createdAt = daysAgo(dayIdx, randomInt(0, 23));
      createdAt.setMinutes(randomInt(0, 59));
      createdAt.setSeconds(randomInt(0, 59));

      // policy_hits: inject real IDs
      const hits = scenario.policyHits.map((h) => ({
        layer: h.layer,
        policy_id: policyIds[h.slug] ?? uuid(),
        slug: h.slug,
        action,
      }));

      const latencyByLayer =
        action !== "BLOCK"
          ? JSON.stringify({ regex: randomInt(3, 12), pattern: randomInt(2, 8), upstream: upstreamMs })
          : JSON.stringify({ regex: randomInt(3, 12), pattern: randomInt(2, 8) });

      await db.query(
        `INSERT INTO interactions
           (id, trace_id, org_id, request_model, prompt, action, reason,
            policy_hits, latency_total_ms, latency_by_layer, upstream_status, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::jsonb,$11,$12)`,
        [
          id, traceId, ORG_ID,
          pick(["claude-sonnet-4-5", "claude-haiku-4-5", "claude-opus-4-7"]),
          scenario.promptTemplate,
          action,
          scenario.reason,
          JSON.stringify(hits),
          totalMs,
          latencyByLayer,
          upstreamMs ? 200 : null,
          createdAt.toISOString(),
        ],
      );
      count++;
    }
  }
  console.log(`   âœ“ ${count} interactions creadas\n`);

  // 6. Rule suggestions
  console.log("ðŸ’¡ Insertando sugerencias del AI Suggestor...");
  for (const s of RULE_SUGGESTIONS) {
    const id = uuid();
    const decidedAt = ["accepted", "rejected"].includes(s.status) ? daysAgo(1).toISOString() : null;
    const acceptedPolicyId = null; // policy created separately when accepted; null is valid

    await db.query(
      `INSERT INTO rule_suggestions
         (id, org_id, proposed_slug, proposed_domain, proposed_layer,
          proposed_rule, proposed_pattern, proposed_match_config, proposed_action,
          proposed_severity, match_count, examples, source_hint, status,
          reject_reason, accepted_policy_id, created_at, decided_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12::jsonb,$13,$14,$15,$16,NOW(),$17)`,
      [
        id, ORG_ID, s.proposedSlug, s.proposedDomain, s.proposedLayer,
        s.proposedRule, s.proposedPattern ?? null, null,
        s.proposedAction, s.proposedSeverity, s.matchCount,
        JSON.stringify(s.examples),
        s.sourceHint ?? null, s.status,
        s.rejectReason ?? null, acceptedPolicyId,
        decidedAt,
      ],
    );
    console.log(`   âœ“ ${s.proposedSlug} [${s.status}]`);
  }

  const blockCount = SCENARIOS.filter((s) => s.action === "BLOCK").length;
  const warnCount = SCENARIOS.filter((s) => s.action === "WARN").length;
  const redactCount = SCENARIOS.filter((s) => s.action === "REDACT").length;
  const logCount = SCENARIOS.filter((s) => s.action === "LOG").length;

  console.log("\nâœ… Seed completo.");
  console.log(`   â€¢ 1 org (demo / Acme Corp)`);
  console.log(`   â€¢ 1 member admin (admin@acme.com)`);
  console.log(`   â€¢ ${POLICIES.length} polÃ­ticas (regex: ${POLICIES.filter(p => p.layer === "regex").length}, pattern: ${POLICIES.filter(p => p.layer === "pattern").length}, nl: ${POLICIES.filter(p => p.layer === "nl").length})`);
  console.log(`   â€¢ ${count} interactions (7 dÃ­as) â€” ${blockCount} plantillas BLOCK, ${warnCount} WARN, ${redactCount} REDACT, ${logCount} LOG`);
  console.log(`   â€¢ ${RULE_SUGGESTIONS.length} sugerencias\n`);

  await pool.end();
}

async function seedPoliciesOnly(orgId) {
  console.log(`ðŸŒ± ArkivGate â€” sembrando solo policies en org "${orgId}"...\n`);

  const orgRow = await db.query(`SELECT id FROM organizations WHERE id = $1`, [orgId]);
  if (orgRow.rowCount === 0) {
    throw new Error(`org "${orgId}" no existe. Logueate primero o pasÃ¡ un --org-id vÃ¡lido.`);
  }

  console.log("ðŸ—‘ï¸  Borrando policies y rule_suggestions previas de la org...");
  await db.query(`DELETE FROM rule_suggestions WHERE org_id = $1`, [orgId]);
  await db.query(`DELETE FROM policies WHERE org_id = $1`, [orgId]);
  console.log("   âœ“ ok\n");

  console.log("ðŸ“‹ Insertando polÃ­ticas...");
  for (const p of POLICIES) {
    const id = uuid();
    const matchConfig = p.matchConfig ? JSON.stringify(p.matchConfig) : null;
    await db.query(
      `INSERT INTO policies
         (id, org_id, slug, domain, layer, rule, pattern, match_config,
          default_action, severity, source, is_active, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,NOW(),NOW())`,
      [
        id, orgId, p.slug, p.domain, p.layer, p.rule,
        p.pattern ?? null, matchConfig,
        p.defaultAction, p.severity, "seed", true,
      ],
    );
    console.log(`   âœ“ ${p.slug} [${p.layer}/${p.domain}]`);
  }

  console.log(`\nâœ… Listo. ${POLICIES.length} policies insertadas en "${orgId}".`);
  await pool.end();
}

const entrypoint = CLI.policiesOnly ? seedPoliciesOnly(ORG_ID) : main();
entrypoint.catch((err) => {
  console.error("âŒ Seed fallÃ³:", err);
  pool.end();
  process.exit(1);
});

