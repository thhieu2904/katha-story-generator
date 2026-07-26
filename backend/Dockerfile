# ---- Builder Stage ----
FROM python:3.11-slim AS builder

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Copy dependency files first for caching (lockfile for reproducible builds)
COPY pyproject.toml uv.lock ./

# Install production dependencies only using locked versions
RUN uv sync --frozen --no-dev --no-install-project

# Copy source code
COPY src/ ./src/
COPY alembic.ini ./
COPY alembic/ ./alembic/

# Install the project itself (needed for src-layout package)
RUN uv sync --frozen --no-dev

# ---- Runner Stage ----
FROM python:3.11-slim AS runner

WORKDIR /app

# Run as an unprivileged user; the app only writes to stdout/R2/DB.
RUN useradd --create-home --uid 1000 app

# Copy the virtual environment from builder
COPY --from=builder /app/.venv /app/.venv

# Copy application code
COPY --from=builder /app/src ./src
COPY --from=builder /app/alembic.ini ./
COPY --from=builder /app/alembic ./alembic

# Put venv on PATH
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONPATH="/app/src"

EXPOSE 8000

USER app

CMD ["uvicorn", "katha.main:app", "--host", "0.0.0.0", "--port", "8000"]
