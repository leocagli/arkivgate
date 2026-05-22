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
- CLI token lookup was validated against Supabase (`cli_tokens` row exists and resolves a member).
- `POST /cli/<token>/v1/messages/count_tokens` reached Anthropic upstream and returned `401 invalid x-api-key` (expected with test key), proving proxy path/token routing.
- `POST /cli/<token>/v1/messages` currently returns `500` on the deployed build; this repo now includes a fix in `interceptor/app/main.py` to make audit persistence/Arkiv bridge failures non-fatal for runtime responses.

### Arkiv Entities Recorded (Explorer)

From the deployed playground/interceptor flow, the following entities were persisted:

- Policy: https://arkiv-testnet-explorer.vercel.app/entity/0xab963b8a0ec8ffec8ff02f2dc89d6bc73dcf952c4230d64040643bded75a30c4
- Prompt review: https://arkiv-testnet-explorer.vercel.app/entity/0xe5500674a719529a0b4c85ee015684d9a6c9235edea249e90d432dd24b9dc2db
- Policy decision: https://arkiv-testnet-explorer.vercel.app/entity/0x51986cba4fce98c58991fb3217ad4631223b659d62ecee65990945dbca315b5d

## License

Private project.
