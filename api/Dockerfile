FROM python:3.12-slim

# Pin uv version for reproducible builds
COPY --from=ghcr.io/astral-sh/uv:0.4.30 /uv /usr/local/bin/uv

WORKDIR /app

# Copy dependency manifests first so this layer is cached
COPY pyproject.toml uv.lock ./

# Create venv and install deps from the lockfile (reproducible).
# Pass --build-arg INSTALL_DEV=true (dev compose) to include dev extras (pytest, ruff, ty).
ARG INSTALL_DEV=false
RUN if [ "$INSTALL_DEV" = "true" ]; then uv sync --frozen --all-extras; else uv sync --frozen; fi

# Make the venv the default Python for the container
ENV PATH="/app/.venv/bin:$PATH"
ENV VIRTUAL_ENV="/app/.venv"

# Copy source (overridden by the volume mount in development)
COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
