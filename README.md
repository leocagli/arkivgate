# ArkivGate

ArkivGate is an AI governance platform for development teams. It adds policy enforcement, auditable decision logs, and team controls around model interactions.

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

## Deployment

- Web: Vercel (root directory: web)
- Interceptor: Railway or Render
- Database: Supabase Postgres

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

Persisted for the validated runtime traces above:

- BLOCK prompt review: https://arkiv-testnet-explorer.vercel.app/entity/0x69db399b2e368ad73347359826b7d0f847473cf374bbf8bee78c0cd11d43023b
- BLOCK policy decision: https://arkiv-testnet-explorer.vercel.app/entity/0x45cba3b64542ffc5916036fcbf48454e1d9d9177e181a6ba54a9da86e27d7195
- LOG prompt review: https://arkiv-testnet-explorer.vercel.app/entity/0x67488d99db9d82587e377113ce291c581ea4d46600a979cd924fb336183f2f3a
- LOG policy decision: https://arkiv-testnet-explorer.vercel.app/entity/0x7664c5f7cc6b633061fe73f545ac2556d69375e1d00e8c91955a431484822754

Previous playground validation entity:

- Policy: https://arkiv-testnet-explorer.vercel.app/entity/0xab963b8a0ec8ffec8ff02f2dc89d6bc73dcf952c4230d64040643bded75a30c4

## License

Private project.
