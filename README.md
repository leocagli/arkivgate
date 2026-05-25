# ArkivGate

ArkivGate is an AI governance platform for development teams and agent runtimes. It adds x402 payment gating, policy enforcement, auditable decision logs, and team controls around model interactions.

## x402 Agent Runtime

ArkivGate now has a demo x402 rail across the project:

- The web playground protects `/api/playground/interceptor-test` with a 402 challenge, signs a demo payment as an agent, reruns the request, and shows the payment response.
- The Python interceptor can protect the real attributed runtime path, `POST /cli/<token>/v1/messages`, when `X402_DEMO_ENABLED=true`.
- Paid executions run through two policy lanes: payment intent policy and prompt policy. Both produce `PASS`, `WARN`, `REDACT`, or `BLOCK`; the final decision uses the highest severity.
- Payment policy examples: moving 100% of wallet balance blocks, moving over 50% above recent behavior warns, exceeding a per-transaction cap redacts/caps the amount.
- The x402 flow now also includes an Arkiv threat-intel lane inspired by community threat registries: the recipient address is checked against reported malicious addresses before execution. A confirmed approval-drain recipient blocks even if the payment amount is small.
- Executions are bridged into Arkiv as connected evidence: paying agent entity, payment review, prompt review, policy decision, and transaction links.
- The public home now includes an Arkiv Evidence Browser that queries by project, entity type, action, severity, agent key, risk score, and time window, then shows relationship keys and retention per entity.
- Wallet identity is now part of the public flow: Reown AppKit / WalletConnect can connect an EVM wallet on Arkiv Braga, and the playground uses that address as the paying agent key for x402 evidence.

This is intentionally demo settlement. It proves the protocol shape and product loop without moving real funds. A real x402 facilitator can replace the demo verifier later without changing the core policy and Arkiv evidence flow.

## ETHNS Challenge Pitch

ArkivGate is positioned for the Arkiv x ETHNS Builder Challenge as an **AI + Privacy** hybrid: paid AI agents can request execution, ArkivGate evaluates payment intent and prompt risk before the model, and the resulting evidence is written as queryable Arkiv entities.

Pitch/demo materials live in [PITCH_DEMO.md](./PITCH_DEMO.md), including:

- 2-3 minute demo script
- challenge rubric mapping
- Arkiv entity/relationship explanation
- submission form copy
- recording checklist

A rubric-based self-assessment lives in [CHALLENGE_SCORECARD.md](./CHALLENGE_SCORECARD.md).

### Arkiv Evidence Browser

The live demo exposes Arkiv as a queryable product layer, not only as explorer links. The browser calls `GET /api/arkiv/evidence` and demonstrates:

- `PROJECT_ATTRIBUTE` filtering with `project=arkivgate-leocagli-2026`.
- Entity filters for `policy_decision`, `prompt_review`, `payment_review`, `agent`, and `policy`.
- Theme filters for `action`, `severity`, `agentKey`, `riskScore >=`, and `createdAt` windows.
- Relationship traversal through `agentEntityKey`, `paymentReviewKey`, `promptReviewKey`, and `policyKey`.
- Differentiated retention for prompt, payment, agent, policy, and decision entities.

### Threat Intelligence Layer

ArkivGate includes a native community threat-intel lane without changing product focus:
reported wallet and contract risk becomes another runtime policy lane for paid agents.

Current demo flow:

- The x402 playground accepts a recipient address.
- The policy engine checks the recipient against a small ArkivGate threat registry.
- A flagged recipient produces `WARN` or `BLOCK` using the same `PASS/WARN/REDACT/BLOCK` vocabulary as prompt and payment policy.
- When flagged, the Arkiv bridge writes:
  - `threat_report` with typed attributes: `recipientAddress`, `threatType`, `severityScore`, `reportCount`, `confirmationCount`, `createdAt`.
  - `threat_confirmation` linked by `threatReportKey`.
  - `payment_review` linked back to the threat report via `threatReportKey`.

Both threat entity types use the same `PROJECT_ATTRIBUTE` and a 90-day TTL, matching the idea that unconfirmed risk reports should decay instead of living forever.

### Wallet Ownership Demo

Set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` with a Reown project ID to enable WalletConnect/AppKit in the public header. The app registers Arkiv Braga as a custom EVM network and uses the connected wallet address as the paying agent identity in the x402 playground.

If the env var is missing, the button falls back to an injected wallet provider such as MetaMask. This keeps the hackathon demo usable while still showing the intended wallet-gated flow.

The public app also includes a wallet-owned write path. A connected user can create an `agent_profile` entity directly from the browser wallet. That entity is created with the same `PROJECT_ATTRIBUTE`, but its Arkiv `$owner` and `$creator` are the connected wallet rather than the backend service wallet.

Ownership split:

- Backend service wallet: writes operational evidence (`agent`, `payment_review`, `prompt_review`, `policy_decision`) so runtime decisions have trusted service attribution.
- End-user wallet: writes `agent_profile` so judges can verify user-owned data on Arkiv.

Both paths stamp `project=arkivgate-leocagli-2026` on every entity.

## Repository Structure

- web/: Next.js app for public site and admin panel
- interceptor/: FastAPI service that evaluates and forwards model requests

## Local Development

1. Configure environment variables in web/.env.local and interceptor/.env.
2. Start dependencies from the repository root as needed.
3. Run the web app:
   - cd web
   - pnpm install
   - pnpm dev
4. Run the interceptor:
   - cd interceptor
   - uv sync
   - uv run uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload

### x402 Runtime Smoke

With the interceptor running and `X402_DEMO_ENABLED=true`, an unpaid agent call receives `402 Payment Required` plus a `PAYMENT-REQUIRED` header. The caller must retry the same resource with `PAYMENT-SIGNATURE`; successful responses include `PAYMENT-RESPONSE`, `x-team22-payment-rail: x402-demo`, and `x-team22-agent-key`.

The playground performs that handshake automatically so demos can show the full loop without a paid Claude API key: payment gate, policy decision, fallback or upstream response, and Arkiv proof.

## Deployment

- Web: Vercel (root directory: web)
- Interceptor: Railway or Render
- Database: Supabase Postgres

### Vercel + Railway contract

For the deployed web to use the real interceptor, set this in Vercel:

```env
ArkivGate_PROXY_URL=https://<railway-interceptor-domain>.up.railway.app
```

For Railway, use `interceptor/` as the service root. Required variables:

```env
DATABASE_URL=postgresql://...
ANTHROPIC_UPSTREAM_URL=https://api.anthropic.com
DEFAULT_ORG_ID=demo
ARKIV_BRIDGE_URL=https://arkivgate.vercel.app/api/internal/arkiv/interactions
ARKIV_BRIDGE_TOKEN=<same-token-as-vercel>
X402_DEMO_ENABLED=true
```

With `X402_DEMO_ENABLED=true`, the web playground signs both hops: first its own
Vercel route, then the Railway interceptor resource (`/cli/<token>/v1/messages`
when a CLI token is provided). Railway should return `/health` as `200 OK`.

## Production Runtime Validation (May 2026)

- Interceptor route hardening is active in production:
   - `POST /v1/messages` returns `401` with hint to use `ArkivGate setup`.
   - `POST /cli/<token>/v1/messages` is the attributed runtime path.
- Runtime lookup is resilient now:
   - token + active policies can be resolved through the web internal fallback when Railway cannot reach Postgres directly.
   - interceptor audit persistence is best-effort; runtime responses no longer fail closed when DB persistence is unavailable.

### Real Runtime E2E

- BLOCK case
   - trace: `01KS6YVSWE0XRT10PETAY4EYJE`
   - request: prompt containing `AKIAIOSFODNN7EXAMPLE`
   - result: `200 OK`
   - action header: `BLOCK`
- LOG/passthrough case
   - trace: `01KS6YW63CZB0AQ85235EX7K0W`
   - request: benign prompt about Observer pattern in TypeScript
   - result: `401 invalid x-api-key` from Anthropic upstream (expected with test key)
   - action header: `LOG`

### Arkiv Entities Recorded (Explorer)

Persisted for the validated runtime traces above via the internal Arkiv bridge replay:

- BLOCK prompt review entity: https://data.arkiv.network/entity/0x69db399b2e368ad73347359826b7d0f847473cf374bbf8bee78c0cd11d43023b
- BLOCK policy decision entity: https://data.arkiv.network/entity/0x45cba3b64542ffc5916036fcbf48454e1d9d9177e181a6ba54a9da86e27d7195
- LOG prompt review entity: https://data.arkiv.network/entity/0x67488d99db9d82587e377113ce291c581ea4d46600a979cd924fb336183f2f3a
- LOG policy decision entity: https://data.arkiv.network/entity/0x7664c5f7cc6b633061fe73f545ac2556d69375e1d00e8c91955a431484822754

Tx hashes are now captured by the Arkiv persistence helpers and should be linked through `https://data.arkiv.network/?query=<txHash>` instead of the deprecated `arkiv-testnet-explorer.vercel.app` host.

Previous playground validation entity:

- Policy: https://data.arkiv.network/entity/0xab963b8a0ec8ffec8ff02f2dc89d6bc73dcf952c4230d64040643bded75a30c4

## Functional Roadmap

This is the current implementation gap between the working MVP and a production-ready operator workflow.

### MVP Ready For Production

1. Automatic persistence without manual replay
   - Stabilize interceptor -> database writes from Railway.
   - Stabilize automatic Arkiv bridge emission from runtime, without depending on manual internal replay.
   - Add bounded retries and explicit failure states when persistence falls back to best-effort mode.

2. Admin visibility for runtime evidence
   - Show trace id, action, policy match reason, Arkiv entity keys, and tx hash links directly in the admin UI.
   - Expose the same evidence now shown in the playground inside operator-facing event views.
   - Make it possible to inspect a runtime decision without using internal routes or scripts.

3. Complete CLI onboarding lifecycle
   - Keep browser approval + device flow stable for real users, not only seeded test tokens.
   - Add clear token status, revoke, and re-issue flows.
   - Improve org-scoped error handling when a user is linked to the wrong org or has an expired approval flow.

4. Policy management hardening
   - Add clearer attribution of which policy or rule caused each BLOCK/REDACT/WARN/LOG result.
   - Support draft/published policy states and safer rollout semantics.
   - Make policy precedence and conflict resolution explicit in the admin workflow.

5. Operational observability
   - Track fallback usage, bridge failures, persistence failures, and upstream latency.
   - Surface health signals for Vercel web, Railway interceptor, and Arkiv bridge.
   - Add operator-visible alerts for events that were evaluated but not fully persisted.

### Post-MVP

1. Policy versioning and environment rollout
   - Version policies over time.
   - Enable publish-by-environment or staged rollout.
   - Allow rollback to a known-good ruleset.

2. Richer admin cockpit
   - Filter and search interactions by trace, user, org member, policy, and action.
   - Add detailed event timelines and drill-down per interaction.
   - Summarize operational impact per policy.

3. Governance workflows
   - Review queues for suggested rules.
   - Approval chains for policy changes.
   - Change history suitable for audits and internal governance reviews.

4. Reliability and scale
   - Queue-backed persistence or bridge dispatch for burst traffic.
   - Better retry semantics and dead-letter handling.
   - Stronger provider abstraction if additional model vendors are added.

### Suggested Build Order

1. Finish automatic persistence and Arkiv emission.
2. Expose runtime evidence in the admin panel.
3. Close the real-user CLI onboarding and token lifecycle.
4. Harden policy rollout semantics.
5. Add observability and alerting.

## License

MIT. See [LICENSE](./LICENSE).
