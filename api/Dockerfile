FROM python:3.12-slim

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Copy dependency manifest first so this layer is cached
COPY pyproject.toml ./

# Create venv and install all deps (including dev extras) with uv
RUN uv venv .venv && \
    uv pip install --python .venv/bin/python -e ".[dev]"

# Make the venv the default Python for the container
ENV PATH="/app/.venv/bin:$PATH"
ENV VIRTUAL_ENV="/app/.venv"

# Copy source (overridden by the volume mount in development)
COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
