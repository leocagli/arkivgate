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

## License

Private project.
