FROM node:22-bookworm-slim AS build
WORKDIR /app
# Enable pnpm
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
# Copy package files
COPY package.json pnpm-lock.yaml* ./
# Fetch dependencies
RUN pnpm fetch
# Copy source
COPY . .
# Install ALL dependencies (including wrangler)
RUN pnpm install --offline --frozen-lockfile
# Build the app
RUN NODE_OPTIONS=--max-old-space-size=4096 pnpm run build

# Production stage
FROM node:22-bookworm-slim
WORKDIR /app
# Enable pnpm
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
# Copy everything INCLUDING node_modules with wrangler
COPY --from=build /app /app

EXPOSE 5173

# FIX: Generate .env.local from environment variables before starting
CMD ["sh", "-c", "env | grep -E 'API_KEY|TOKEN|URL|CONFIG' > .env.local && pnpm run dockerstart"]
