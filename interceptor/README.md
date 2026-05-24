# ArkivGate â€” interceptor (v0.3)

Proxy Python que se mete entre Claude Code y `api.anthropic.com`. Lee
polÃ­ticas de Postgres (la DB que comparte con `web/`) y aplica la
cascada antes de forwardear.

## x402 para agentes

El interceptor puede exigir un pago x402 demo antes de ejecutar
`POST /cli/{token}/v1/messages`.

```env
X402_DEMO_ENABLED=true
```

Con esa variable activa, el primer request sin pago devuelve:

- `HTTP 402`
- header `PAYMENT-REQUIRED`
- body `payment_required`

El agente reintenta el mismo recurso con `PAYMENT-SIGNATURE`. Si la firma demo
es valida, ArkivGate ejecuta la cascada normal y responde con:

- `PAYMENT-RESPONSE`
- `x-team22-payment-rail: x402-demo`
- `x-team22-agent-key: <payer>`

El bridge manda ese `agentKey` al web, y el web lo persiste como entidad
`agent` en Arkiv junto a `PromptReview` y `PolicyDecision`.

Antes de tocar upstream, el interceptor tambien evalua el intento de fondos del
pago demo si viene incluido en la firma:

- `PASS`: monto normal para el balance y el historial.
- `WARN`: mas de 50% del balance y por encima del maximo reciente.
- `REDACT`: excede el cap por transaccion; el monto se capea.
- `BLOCK`: mueve 100% o mas del balance, o el recipient es high risk.

El bridge envia esa evaluacion como `paymentPolicy`, y el web la registra como
`payment_review` en Arkiv.

> Importante: esto es settlement demo. No mueve fondos reales todavia; deja el
> contrato del producto listo para conectar un facilitador x402 real.

## Arkiv bridge (MVP)

Opcionalmente, cada decisiÃ³n persistida (`BLOCK`, `REDACT`, `WARN`, `LOG`) se puede reenviar al web para escribir evidencia en Arkiv.

Variables nuevas en `.env`:

```env
ARKIV_BRIDGE_URL=http://localhost:3000/api/internal/arkiv/interactions
ARKIV_BRIDGE_TOKEN=change-me
```

Con eso activo, el interceptor hace POST al bridge interno y el web crea entidades `PromptReview` y `PolicyDecision` en Arkiv usando la wallet del backend.

**v0.3 alcance**:

- **Layer 1 â€” Regex**: matchers literales contra el prompt. Acciones `BLOCK` y `LOG` (passthrough).
- **Layer 3 â€” NL Judge** (Haiku 4.5): si regex no bloqueÃ³ y hay reglas en lenguaje natural activas, manda el prompt + reglas a Haiku en una sola call y aplica el resultado.
- **AtribuciÃ³n por dev** (path-based): ademÃ¡s de `POST /v1/messages` (compat) acepta `POST /cli/{token}/v1/messages`. El CLI bakea el token en `ANTHROPIC_BASE_URL=<proxy>/cli/<token>` durante `ArkivGate setup`, y cada `interactions` queda atado al `member_id` correcto + override del `org_id`. El token se hashea (sha256) y se mira en `cli_tokens`; si no existe / estÃ¡ revocado â†’ 401. Token desconocido en `count_tokens` no bloquea (solo el path real lo hace).
- Logging estructurado (`[req] [regex] [nl] [judge] [done]`) para tracear cada paso. `[req]` ahora incluye `user=<member_id>` cuando el caller vino vÃ­a `/cli/{token}`.

REDACT, WARN y Layer 2 (pattern matcher) quedan para prÃ³ximas versiones.

## Stack

- Python 3.12 + FastAPI + uvicorn.
- SQLModel + asyncpg sobre la Postgres compartida con `web/`.
- httpx async para reenviar a Anthropic **y** para llamar al judge (Haiku 4.5).
- `uv` para deps.

> El schema canÃ³nico vive en `web/prisma/schema.prisma`. Este servicio
> **no** ejecuta migraciones â€” sÃ³lo lee `policies` y escribe `interactions`.

## Setup

Desde el root del repo, asegurate que Postgres estÃ© arriba y migrado por
`web/`:

```bash
docker compose up -d
cd web && pnpm install && pnpm prisma migrate deploy
```

DespuÃ©s, el interceptor:

```bash
cd interceptor
cp .env.example .env        # editar â€” ANTHROPIC_JUDGE_API_KEY es la Ãºnica clave a pegar
uv sync                     # instala deps
uv run python scripts/seed_policies.py   # 4 reglas regex de credenciales
uv run uvicorn app.main:app --reload --port 8080
```

> **Habilitar el NL judge** (opcional pero recomendado): pegÃ¡ una API key de Anthropic en `ANTHROPIC_JUDGE_API_KEY` (sacala de <https://console.anthropic.com/settings/keys>). Si estÃ¡ vacÃ­a, el proxy se comporta como v0.1 (solo regex + passthrough). El judge corre con la key del servidor â€” no depende de las credenciales del cliente, asÃ­ que evita problemas de OAuth scopes y betas no habilitadas.

## Smoke test

**BLOCK** (no requiere `ANTHROPIC_API_KEY` real â€” la cascada decide antes
de tocar upstream):

```bash
curl -i -X POST http://localhost:8080/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-team22-org-key: demo" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 256,
    "messages": [{"role":"user","content":"AKIAIOSFODNN7EXAMPLE"}]
  }'
```

Esperado: `HTTP 200`, header `x-team22-action: BLOCK`,
`stop_reason: ArkivGate_blocked` y un mensaje en espaÃ±ol explicando la regla.

**LOG passthrough** (requiere `x-api-key` vÃ¡lida para que Anthropic
responda 200; con key fake devuelve 401 propagado):

```bash
curl -i -X POST http://localhost:8080/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "x-team22-org-key: demo" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 256,
    "messages": [{"role":"user","content":"explicame el patrÃ³n Observer"}]
  }'
```

Esperado: el status code y el body son lo que Anthropic devolviÃ³;
agregamos sÃ³lo `x-team22-trace-id` y `x-team22-action: LOG`.

## Probar contra el CLI real

```bash
ANTHROPIC_BASE_URL=http://localhost:8080 claude "AKIAIOSFODNN7EXAMPLE"
```

El CLI deberÃ­a renderizar el mensaje del proxy como si fuera respuesta
del modelo.

## Estructura

```
interceptor/
â”œâ”€â”€ app/
â”‚   â”œâ”€â”€ main.py             # FastAPI app + POST /v1/messages (cascada)
â”‚   â”œâ”€â”€ config.py           # settings desde .env
â”‚   â”œâ”€â”€ db.py               # async engine + session
â”‚   â”œâ”€â”€ enums.py            # mirrors de los enums Postgres
â”‚   â”œâ”€â”€ models.py           # SQLModel: Policy (read), Interaction (write)
â”‚   â”œâ”€â”€ schemas.py          # Pydantic shapes de la Messages API
â”‚   â”œâ”€â”€ cascade.py          # Layer 1 â€” regex matcher
â”‚   â”œâ”€â”€ nl_layer.py         # Layer 3 â€” Haiku 4.5 judge (httpx â†’ Anthropic)
â”‚   â”œâ”€â”€ redact.py           # redacciÃ³n del prompt antes de persistir
â”‚   â”œâ”€â”€ block_response.py   # synthesizer de Message en BLOCK
â”‚   â””â”€â”€ upstream.py         # cliente httpx contra api.anthropic.com
â””â”€â”€ scripts/
    â”œâ”€â”€ seed_policies.py    # 4 reglas regex mÃ­nimas para smoke-test (deprecado)
    â””â”€â”€ seed_prod.py        # seed completo de producciÃ³n â€” ver secciÃ³n abajo
```

## Seed de producciÃ³n

`scripts/seed_prod.py` carga el conjunto de datos realista para producciÃ³n y demos.

**QuÃ© inserta:**

| Tabla | Cantidad | DescripciÃ³n |
|---|---|---|
| `policies` | 25 | credentials Â· pii Â· code Â· business_policy Â· internal_paths |
| `interactions` | 25 | 8 LOG Â· 6 WARN Â· 6 REDACT Â· 5 BLOCK distribuidos en 30 dÃ­as |
| `rule_suggestions` | 6 | 3 pending Â· 1 accepted Â· 2 rejected (con motivo) |

**CategorÃ­as de policies incluidas:**
- **Credentials (regex):** AWS Access Key, GitHub token, PEM key, Anthropic/OpenAI API keys, connection strings con credenciales, variables de entorno con secretos.
- **PII (regex + nl):** tarjeta de crÃ©dito, RUT, DNI, IBAN, telÃ©fonos masivos, registros de salud, datos financieros personales.
- **Code (regex + nl):** credenciales hardcodeadas en cÃ³digo, bypass de seguridad con TODO, cÃ³digo sin tests, sin manejo de errores.
- **Business policy (nl):** roadmap de producto, estrategia de precios, comparaciÃ³n con competidores, OKRs confidenciales, criterios de implementaciÃ³n (code review, CI/CD).
- **Internal paths (pattern):** archivos `.env`/`.pem`/`.key`, configuraciÃ³n de infraestructura (Terraform, K8s).

**EjecuciÃ³n:**

```bash
cd interceptor

# local (Docker Postgres)
uv run python scripts/seed_prod.py

# producciÃ³n (Supabase)
DATABASE_URL='postgresql://...' uv run python scripts/seed_prod.py

# org especÃ­fica
uv run python scripts/seed_prod.py --org acme
```

Es idempotente: re-correr actualiza policies, no duplica interactions ni suggestions.

## Deploy a Railway

El servicio estÃ¡ pensado para correr en Railway con la Postgres compartida
en Supabase.

### 1 â€” preparar la DB

El schema canÃ³nico vive en `web/prisma/`. Antes del primer deploy:

1. Crear proyecto en Supabase y habilitar la extensiÃ³n `vector`
   (Dashboard â†’ Database â†’ Extensions).
2. Desde `web/`, apuntar `DATABASE_URL` al DSN directo de Supabase
   (no el pooler) y correr `pnpm prisma migrate deploy`.
3. Cargar los datos de producciÃ³n:
   `cd interceptor && DATABASE_URL='...' uv run python scripts/seed_prod.py`

### 2 â€” crear el servicio en Railway

Desde `interceptor/` con `railway` CLI logueado:

```bash
railway login                 # si no estÃ¡s logueado
railway init                  # crea proyecto, o `railway link` para uno existente
railway variables \
  --set DATABASE_URL='postgresql://postgres:<password>@<host>:5432/postgres' \
  --set ANTHROPIC_UPSTREAM_URL='https://api.anthropic.com' \
  --set ANTHROPIC_JUDGE_API_KEY='sk-ant-...' \
  --set DEFAULT_ORG_ID='demo'
railway up
```

El root del servicio en Railway tiene que ser `interceptor/` (configurable
en Settings â†’ Source â†’ Root Directory si lo creaste desde el dashboard).

### 3 â€” verificar

```bash
curl https://<tu-dominio>.up.railway.app/health
# â†’ {"status":"ok"}
```

Y desde el CLI:

```bash
ANTHROPIC_BASE_URL=https://<tu-dominio>.up.railway.app claude "AKIAIOSFODNN7EXAMPLE"
```

### Notas

- **Driver async**: `app/db.py` reescribe automÃ¡ticamente `postgresql://` â†’
  `postgresql+asyncpg://`. PegÃ¡ el DSN de Supabase tal cual.
- **SSL**: la conexiÃ³n a hosts no-locales fuerza `ssl=require`. No hace
  falta tocar nada para Supabase.
- **Pooler vs direct**: usar la connection direct (puerto 5432) â€” el pooler
  de Supabase (puerto 6543) usa pgbouncer en transaction mode y necesita
  `prepared_statement_cache_size=0`, no soportado en v0.1.

## PrÃ³ximas versiones

- v0.4 â€” REDACT mutator + WARN.
- v0.5 â€” Layer 2 (pattern matcher para filename/path).
- v0.6 â€” embedding-based pre-filter (pgvector top-K) antes del judge.
- v0.7 â€” streaming (`stream: true` para chat normal del CLI).
- v0.8 â€” fail-closed real cuando upstream timeoutea.

