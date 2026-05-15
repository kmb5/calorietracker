FROM node:20-alpine

WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy manifests first so the install layer is cached
COPY package.json ./

# Install deps (pnpm-lock.yaml is generated on first install if absent)
RUN pnpm install

# Copy source (overridden by the volume mount in development)
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Start Vite; --host binds to 0.0.0.0 so the port is reachable from the host
CMD ["pnpm", "run", "dev", "--host"]
