# ArkivGate

<p align="center">
  <img width="960" alt="ArkivGate logo" src="https://github.com/user-attachments/assets/f227f9fd-d321-4c5b-bd48-3bb8e3ce4e2d" />
</p>

ArkivGate is a policy gateway for AI agents and paid agent runtimes. It sits between the agent and the model/API call, evaluates prompt risk, x402 payment intent, and wallet threat intelligence, then writes auditable evidence to Arkiv.

Live demo: https://arkivgate.vercel.app  
Arkiv data explorer: https://data.arkiv.network

## What It Does

ArkivGate protects three execution paths with the same decision vocabulary: `PASS`, `WARN`, `REDACT`, and `BLOCK`.

1. Prompt security
   - Blocks or redacts secrets, production credentials, PII, and organization-specific policy violations.
   - Demo example: an AWS-style key plus `.env` reference is blocked before reaching the model.

2. x402 paid agent execution
   - The playground protects `/api/playground/interceptor-test` with a 402 challenge.
   - The agent signs a demo x402 payment and retries the request.
   - Payment intent is evaluated independently from the prompt: wallet balance, transfer amount, recent behavior, per-transaction cap, and recipient risk.

3. Wallet threat intelligence
   - Recipient addresses are checked against ArkivGate threat reports.
   - A flagged approval-drain style recipient can block the execution even when the transfer amount is small.

Every execution can produce Arkiv entities for the paying agent, payment review, prompt review, threat report, threat confirmation, policy, and policy decision.

## Demo Screenshots

### Paid Agent Flow

The public playground shows the x402 handshake, payment policy, prompt policy, and Arkiv threat-intel result in one run.

<img width="1146" height="625" alt="ArkivGate paid agent playground" src="https://github.com/user-attachments/assets/b16a5949-a8d2-4709-8704-1132f851703b" />

After the run, ArkivGate shows the persisted entity links and transaction evidence.

<img width="1125" height="603" alt="ArkivGate transaction confirmation" src="https://github.com/user-attachments/assets/4990dcdd-164b-42bf-8bc9-4f945c99a68a" />

### Arkiv Evidence

Evidence is queryable in Arkiv by project, entity type, severity, action, agent key, and relationship keys.

<img width="1388" height="927" alt="ArkivGate logs on data.arkiv" src="https://github.com/user-attachments/assets/f3b7c51d-4c7a-46b7-8e57-811c022d7845" />

<img width="1598" height="828" alt="ArkivGate entity browser on data.arkiv" src="https://github.com/user-attachments/assets/26b1e260-9d58-47d5-b3f3-f1929655aa47" />

Example Arkiv query:

https://data.arkiv.network/?q=$key+=+%220x1eb559ef0a11f18c373ef55d468f0e038564a4776317d78ed64675f3447dbdec%22

## Why Arkiv

ArkivGate uses Arkiv as the product data layer, not just as a final explorer link.

- `PROJECT_ATTRIBUTE`: every entity is stamped with `project=arkivgate-leocagli-2026`.
- Typed entities: `agent`, `agent_profile`, `policy`, `payment_review`, `prompt_review`, `policy_decision`, `threat_report`, and `threat_confirmation`.
- Queryable attributes: action, severity, agent key, risk score, recipient address, created time, entity type, and relationship keys.
- Relationships: child entities link through attributes such as `agentEntityKey`, `paymentReviewKey`, `promptReviewKey`, `policyKey`, and `threatReportKey`.
- Ownership split:
  - Backend service wallet writes operational evidence for trusted runtime attribution.
  - Connected end-user wallet can write `agent_profile`, making user-owned data verifiable on Arkiv.
- Differentiated retention: short-lived prompt/payment evidence, longer-lived policy and agent records, and 90-day threat reports that decay if not reinforced.

## ETHNS Challenge Positioning

Theme: **AI + Privacy / Security**

ArkivGate demonstrates a paid AI-agent control plane:

```text
Agent request
  -> x402 payment challenge
  -> payment intent policy
  -> prompt policy
  -> wallet threat-intel check
  -> final PASS/WARN/REDACT/BLOCK decision
  -> Arkiv evidence graph
```

Pitch/demo materials:

- [PITCH_DEMO.md](./PITCH_DEMO.md): 2-3 minute demo script, submission copy, recording checklist.
- [CHALLENGE_SCORECARD.md](./CHALLENGE_SCORECARD.md): rubric self-assessment.

## x402 Runtime

ArkivGate currently ships a demo x402 settlement rail:

- The web playground protects `/api/playground/interceptor-test`.
- The first request returns `402 Payment Required`.
- The frontend signs a demo `PAYMENT-SIGNATURE`.
- The route reruns the request and returns `PAYMENT-RESPONSE`.
- The final decision is persisted to Arkiv when Arkiv is reachable.

This is intentionally demo settlement. It proves the protocol shape and policy loop without moving real funds. A production x402 facilitator can replace the demo verifier while keeping the same policy and evidence model.

## Admin Panel

The admin panel is designed for security/compliance operators:

- Events: evaluated interactions and decision logs.
- Rules: policy controls and enforcement actions.
- Analytics: action breakdowns and latency.
- Suggestions: policy improvement queue.
- Arkiv: setup status, smoke test, and entity explorer.
- API keys: generate runtime secrets for customer sites, wallets, dApps, and agent clients.

Generated API keys are shown once. Clients can route traffic through:

```env
ANTHROPIC_BASE_URL=https://arkivgate.vercel.app/cli/<secret>
```

## Repository Structure

```text
web/          Next.js app for public site, playground, API routes, and admin panel
interceptor/  FastAPI service that evaluates and forwards model requests
```

## Local Development

1. Configure environment variables:
   - `web/.env.local`
   - `interceptor/.env`
2. Run the web app:

```bash
cd web
pnpm install
pnpm dev
```

3. Run the interceptor:

```bash
cd interceptor
uv sync
uv run uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload
```

## Key Environment Variables

### Web / Vercel

```env
DATABASE_URL=postgresql://...
AUTH_URL=https://arkivgate.vercel.app
AUTH_SECRET=...
NEXT_PUBLIC_APP_URL=https://arkivgate.vercel.app
DEMO_ORG_ID=demo
ArkivGate_PROXY_URL=https://<railway-interceptor-domain>.up.railway.app

ARKIV_PROJECT=arkivgate-leocagli-2026
ARKIV_CHAIN=braga
ARKIV_AGENT_PRIVATE_KEY=...
ARKIV_BRIDGE_TOKEN=...

SUPABASE_PROJECT_ID=...
SUPABASE_SECRET_KEY=...

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
```

### Interceptor / Railway

```env
DATABASE_URL=postgresql://...
ANTHROPIC_UPSTREAM_URL=https://api.anthropic.com
DEFAULT_ORG_ID=demo
ARKIV_BRIDGE_URL=https://arkivgate.vercel.app/api/internal/arkiv/interactions
ARKIV_BRIDGE_TOKEN=<same-token-as-vercel>
X402_DEMO_ENABLED=true
```

Railway should expose `/health` as `200 OK`.

## Runtime Smoke

With the interceptor running and `X402_DEMO_ENABLED=true`:

- Unpaid agent call receives `402 Payment Required` and a `PAYMENT-REQUIRED` header.
- Caller retries the same resource with `PAYMENT-SIGNATURE`.
- Successful responses include:
  - `PAYMENT-RESPONSE`
  - `x-team22-payment-rail: x402-demo`
  - `x-team22-agent-key`

The web playground performs this handshake automatically.

## Production Runtime Validation

Validated behavior as of May 2026:

- `POST /v1/messages` returns `401` with a hint to use ArkivGate setup.
- `POST /cli/<token>/v1/messages` is the attributed runtime path.
- Runtime lookup can fall back through the web internal context route when Railway cannot reach Postgres directly.
- Audit persistence is best-effort; runtime responses no longer fail closed when DB persistence is unavailable.

Example traces:

- BLOCK trace: `01KS6YVSWE0XRT10PETAY4EYJE`
  - Prompt contained `AKIAIOSFODNN7EXAMPLE`.
  - Result: `200 OK`, action `BLOCK`.
- LOG trace: `01KS6YW63CZB0AQ85235EX7K0W`
  - Benign TypeScript prompt.
  - Result: upstream Anthropic `401 invalid x-api-key` with action `LOG`, expected for test keys.

Persisted Arkiv entities:

- BLOCK prompt review: https://data.arkiv.network/entity/0x69db399b2e368ad73347359826b7d0f847473cf374bbf8bee78c0cd11d43023b
- BLOCK policy decision: https://data.arkiv.network/entity/0x45cba3b64542ffc5916036fcbf48454e1d9d9177e181a6ba54a9da86e27d7195
- LOG prompt review: https://data.arkiv.network/entity/0x67488d99db9d82587e377113ce291c581ea4d46600a979cd924fb336183f2f3a
- LOG policy decision: https://data.arkiv.network/entity/0x7664c5f7cc6b633061fe73f545ac2556d69375e1d00e8c91955a431484822754
- Playground policy example: https://data.arkiv.network/entity/0xab963b8a0ec8ffec8ff02f2dc89d6bc73dcf952c4230d64040643bded75a30c4

## Roadmap

Current production hardening priorities:

1. Stabilize automatic Railway -> web -> Arkiv persistence with bounded retries.
2. Show trace id, action, policy reason, entity keys, and tx hashes directly in admin event views.
3. Complete real-user CLI onboarding and token lifecycle.
4. Add policy versioning, draft/published rollout, and rollback.
5. Add operator-visible health signals for Vercel, Railway, Supabase, and Arkiv.

## License

MIT. See [LICENSE](./LICENSE).
