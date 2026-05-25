# web Â· landing + back-office

Next.js 16 (App Router) + Tailwind 4 + Prisma 7 + Auth.js v5. Sirve dos cosas:

- **Landing pÃºblica** (`/`) â€” el pitch del producto.
- **Back-office del admin** (`/admin/*`) â€” gestiÃ³n de reglas, eventos en vivo y team management.
- **Device-flow del CLI** (`/cli/connect`) â€” el browser-side del onboarding del dev.
- **ArkivGate MVP endpoints** (`/api/admin/arkiv/*`) â€” smoke test y consultas de entidades en Arkiv.
- **x402 playground** (`/api/playground/interceptor-test`) â€” demo del loop 402, firma de agente, decision de politica y evidencia Arkiv.

## Stack

| | |
|---|---|
| Framework | Next.js 16 (Turbopack) + React 19 |
| Styling | Tailwind v4 (CSS-first) + IBM Plex Sans/Mono |
| ORM | Prisma 7 con `@prisma/adapter-pg` |
| DB | Postgres + `pgvector` (Docker local o Supabase / Railway en prod) |
| Auth | Auth.js v5 (NextAuth) con Google OAuth provider |

## Setup local

Requiere Docker (para Postgres), Node 20+ y pnpm.

```bash
# 1. Postgres + extensiÃ³n vector
docker compose -f ../docker-compose.yml up -d

# 2. Deps + cliente Prisma + migraciones
pnpm install
pnpm db:migrate          # idempotente

# 3. Variables de entorno
cp .env.example .env.local
# editar .env.local â€” ver "Auth con Google" mÃ¡s abajo si vas a probar el login real

# 4. Dev server
pnpm dev                 # http://localhost:3000
```

## Modos de auth

El back-office tiene dos modos segÃºn las env vars:

### Modo demo (default, sin Google)

Si `GOOGLE_CLIENT_ID` estÃ¡ vacÃ­o, el proxy mantiene el shortcut histÃ³rico:

- `http://localhost:3000/admin?demo=1` â†’ setea cookie `admin_session=demo` â†’ redirige a `/admin/events`.
- Todo bajo `org_id=demo` con member mock `admin@team22.dev`.

Ãštil para arrancar rÃ¡pido y para la demo del pitch sin tener que loguear.

### Modo Google (recomendado fuera del pitch)

PegÃ¡s credenciales reales en `.env.local`:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
AUTH_SECRET=...                    # `openssl rand -base64 32`
AUTH_URL=http://localhost:3000     # absolute URL pÃºblica
```

Con eso activo:

- `?demo=1` queda desactivado.
- `/admin` redirige a `/admin/login`.
- Click "Continuar con Google" â†’ primer login crea **org nueva con vos como admin** (la lÃ³gica vive en `src/lib/org-resolution.ts`).
- Logins posteriores con el mismo email te llevan directo a tu org.
- Si un admin ya te invitÃ³ desde `/admin/team`, te asocia al `member` preexistente (con tu rol, dev o admin).

#### Crear el OAuth app en Google Cloud Console

1. <https://console.cloud.google.com/> â†’ proyecto nuevo (o existente).
2. **APIs & Services â†’ OAuth consent screen** â†’ User Type *External* â†’ completÃ¡ lo mÃ­nimo. Status *Testing*.
3. **APIs & Services â†’ Credentials â†’ + Create Credentials â†’ OAuth client ID** â†’ Web application.
   - **Authorized JavaScript origins**: `http://localhost:3000` (+ tu dominio de prod).
   - **Authorized redirect URIs**: `http://localhost:3000/api/auth/callback/google` (+ idem prod).
4. CopiÃ¡ Client ID + Secret â†’ `.env.local`.
5. Mientras estÃ© en Testing, agregÃ¡ tu email en *Test users* del consent screen.

## Estructura

```
web/
â”œâ”€â”€ prisma/
â”‚   â”œâ”€â”€ schema.prisma            # schema canÃ³nico (Ãºnica fuente de verdad)
â”‚   â””â”€â”€ migrations/              # historial de migraciones SQL
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ app/
â”‚   â”‚   â”œâ”€â”€ page.tsx             # landing pÃºblica
â”‚   â”‚   â”œâ”€â”€ admin/
â”‚   â”‚   â”‚   â”œâ”€â”€ layout.tsx       # shell (sidebar + header + signout)
â”‚   â”‚   â”‚   â”œâ”€â”€ events/          # feed live con polling 3s
â”‚   â”‚   â”‚   â”œâ”€â”€ rules/           # CRUD de policies + wizard NL
â”‚   â”‚   â”‚   â”œâ”€â”€ team/            # invitar/listar devs (admin gate)
â”‚   â”‚   â”‚   â”œâ”€â”€ login/           # button "Continuar con Google"
â”‚   â”‚   â”‚   â””â”€â”€ suggestions/     # cola del AI Suggestor
â”‚   â”‚   â”œâ”€â”€ api/
â”‚   â”‚   â”‚   â”œâ”€â”€ admin/           # CRUD endpoints â€” auth obligatoria
â”‚   â”‚   â”‚   â”œâ”€â”€ auth/            # NextAuth route handler
â”‚   â”‚   â”‚   â””â”€â”€ cli/             # device flow + me + logout
â”‚   â”‚   â””â”€â”€ cli/
â”‚   â”‚       â””â”€â”€ connect/         # browser side del device flow
â”‚   â”œâ”€â”€ auth.ts                  # NextAuth full (con Prisma adapter)
â”‚   â”œâ”€â”€ auth.config.ts           # base config edge-safe (proxy.ts)
â”‚   â”œâ”€â”€ proxy.ts                 # gating /admin/* y /api/admin/* (modo hÃ­brido)
â”‚   â””â”€â”€ lib/
â”‚       â”œâ”€â”€ prisma.ts            # cliente singleton
â”‚       â”œâ”€â”€ admin-session.ts     # resolver: Google â†’ orgId/email
â”‚       â”œâ”€â”€ org-resolution.ts    # auto-crear org / linkear invitaciÃ³n
â”‚       â”œâ”€â”€ cli-auth.ts          # resuelve Authorization â†’ member
â”‚       â””â”€â”€ cli-tokens.ts        # generaciÃ³n + hash de tokens
â””â”€â”€ public/                      # assets estÃ¡ticos
```

## Scripts

| Script | QuÃ© hace |
|---|---|
| `pnpm dev` | Dev server con Turbopack. |
| `pnpm build` | Build de producciÃ³n. |
| `pnpm typecheck` | `tsc --noEmit`. |
| `pnpm lint` | ESLint. |
| `pnpm db:up` | Levanta Postgres del docker-compose root. |
| `pnpm db:migrate` | `prisma migrate deploy` (prod-safe, idempotente). |
| `pnpm db:migrate:dev` | `prisma migrate dev` interactivo (genera nuevas migraciones). |
| `pnpm db:reset` | Reset de la DB local. |
| `pnpm db:studio` | Abre Prisma Studio en `http://localhost:5555`. |
| `pnpm db:generate` | Regenera el cliente Prisma. |
| `pnpm arkiv:smoke` | Smoke test de ArkivGate. |

## x402 playground

El playground de la landing protege su endpoint con x402 demo. El primer POST
recibe `402` + `PAYMENT-REQUIRED`; el front firma como agente demo, reintenta
con `PAYMENT-SIGNATURE` y muestra `PAYMENT-RESPONSE` junto a la entidad Arkiv
del agente pagador.

Si `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` está seteado, el header usa Reown
AppKit / WalletConnect y registra Arkiv Braga como red EVM custom. La wallet
conectada pasa a ser el `payer` del x402 demo y el `agentKey` usado para filtrar
evidencia. Si falta esa env, el botón intenta usar una wallet inyectada del
browser para no bloquear la demo local.

La landing tambien incluye un write directo desde wallet: `agent_profile`.
Ese create usa `createWalletClient({ transport: custom(walletProvider) })`, por
lo que la entidad queda con `$owner` y `$creator` de la wallet conectada. Igual
que las entidades backend, tambien lleva `PROJECT_ATTRIBUTE`.

El playground tiene dos policy lanes con el mismo vocabulario:

- `x402 payment policy`: evalua balance, monto a transferir, historial, cap por transaccion y riesgo del recipient.
- `Arkiv threat intel`: evalua si el recipient esta reportado como contrato o wallet maliciosa.
- `prompt policy`: evalua el contenido del prompt con las reglas `PASS`, `BLOCK`, `REDACT`, `WARN`.

La decision final usa la peor severidad entre ambas. No mueve fondos reales.
Sirve para validar el producto completo: agente paga, fondos y prompt pasan por
politica, recipient pasa por threat intelligence, Arkiv registra.

Cuando el recipient esta reportado, el bridge persiste `threat_report` y
`threat_confirmation` con TTL de 90 dias, y los relaciona desde `payment_review`
mediante `threatReportKey`.

## Deploy

Pensado para Vercel â€” `vercel.json` no requerido, todo es App Router estÃ¡ndar. Variables a setear en producciÃ³n:

| Var | Notas |
|---|---|
| `DATABASE_URL` | DSN directo a Postgres (Supabase / Railway / Neon). |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Mismas que en local pero con `Authorized redirect URI` apuntando al dominio de prod. |
| `AUTH_SECRET` | `openssl rand -base64 32` (uno por entorno). |
| `AUTH_URL` | URL pÃºblica del web (ej. `https://ArkivGate.app`). |
| `ArkivGate_PROXY_URL` | URL del interceptor (Railway). El device-flow `/start` la inyecta en la respuesta al CLI. |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Opcional. Project ID de Reown para WalletConnect/AppKit. |

Para mÃ¡s contexto del producto, leÃ© el [README del repo](../README.md) y los [specs](../specs/README.md).

