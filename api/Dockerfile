FROM python:3.12-slim

# Pin uv version for reproducible builds
COPY --from=ghcr.io/astral-sh/uv:0.4.30 /uv /usr/local/bin/uv

WORKDIR /app

# Copy dependency manifests first so this layer is cached
COPY pyproject.toml uv.lock ./

# Create venv and install all deps from the lockfile (reproducible)
RUN uv sync --frozen --all-extras

# Make the venv the default Python for the container
ENV PATH="/app/.venv/bin:$PATH"
ENV VIRTUAL_ENV="/app/.venv"

# Copy source (overridden by the volume mount in development)
COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
