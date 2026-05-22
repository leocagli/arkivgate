FROM python:3.12-slim

WORKDIR /app

# Install uv once; project deps are resolved from interceptor/pyproject.toml.
RUN pip install --no-cache-dir uv

COPY interceptor/pyproject.toml /app/pyproject.toml
COPY interceptor/uv.lock /app/uv.lock
RUN uv sync --frozen --no-dev

COPY interceptor/ /app/

ENV HOST=0.0.0.0
ENV PORT=8080

CMD ["sh", "-c", "uv run --frozen --no-dev uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips=*"]