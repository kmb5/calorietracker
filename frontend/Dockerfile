FROM node:20-alpine

WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy manifests first so the install layer is cached
COPY package.json pnpm-lock.yaml ./

# Install deps from the lockfile — reproducible, fails if lock is out of date
RUN pnpm install --frozen-lockfile

# Copy source (overridden by the volume mount in development)
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Start Vite; --host binds to 0.0.0.0 so the port is reachable from the host
CMD ["pnpm", "run", "dev", "--host"]
