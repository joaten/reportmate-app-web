# Frontend Dockerfile for Next.js
# Node.js 24 LTS: 20 is end-of-life and gets no security fixes
FROM node:24-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm. PINNED: `npm install -g pnpm` resolves the latest release the
# base image can run, so the toolchain moved on its own and broke this build.
# 10.34.5 matches pnpm-lock.yaml. 12.x is a standalone binary that ignores the
# Node constraint, which is how it got pulled in on 2026-08-26 and turned
# ignored build scripts into a hard error. Move to 11.x deliberately, not by drift.
RUN npm install -g pnpm@10.34.5

# Install dependencies based on the preferred package manager
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Install pnpm (pinned to match the deps stage above)
RUN npm install -g pnpm@10.34.5

# Set environment variable for Docker build
ENV DOCKER_BUILD=true

# Accept build args for version tracking
ARG IMAGE_TAG=unknown
ARG BUILD_TIME=""
ARG BUILD_ID=""
ARG API_BASE_URL=""
ARG NEXT_PUBLIC_API_BASE_URL=""
ARG ENABLE_SIGNALR="true"
ARG WPS_URL=""
# Bakes demo mode into the image. Not needed for the published image:
# set DEMO_MODE=true on the running container instead (src/lib/demo-mode.ts).
ARG NEXT_PUBLIC_DEMO_MODE="false"

# Set build-time environment variables
ENV CONTAINER_IMAGE_TAG=${IMAGE_TAG}
ENV BUILD_TIME=${BUILD_TIME}
ENV BUILD_ID=${BUILD_ID}
ENV NEXT_PUBLIC_VERSION=${IMAGE_TAG}
ENV NEXT_PUBLIC_BUILD_TIME=${BUILD_TIME}
ENV NEXT_PUBLIC_BUILD_ID=${BUILD_ID}
# API_BASE_URL = Internal URL for server-side API routes (container-to-container)
ENV API_BASE_URL=${API_BASE_URL}
# NEXT_PUBLIC_API_BASE_URL = External URL for client-side browser calls
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_ENABLE_SIGNALR=${ENABLE_SIGNALR}
ENV NEXT_PUBLIC_WPS_URL=${WPS_URL}
ENV NEXT_PUBLIC_DEMO_MODE=${NEXT_PUBLIC_DEMO_MODE}

# Build the app
RUN node -e 'require("node:fs").writeFileSync("build-info.json", JSON.stringify({version:process.env.CONTAINER_IMAGE_TAG, imageTag:process.env.CONTAINER_IMAGE_TAG, buildId:process.env.BUILD_ID, buildTime:process.env.BUILD_TIME}))'
RUN pnpm build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED 1

# Copy build args from builder stage for runtime
ARG IMAGE_TAG=unknown
ARG BUILD_TIME=""
ARG BUILD_ID=""
ARG API_BASE_URL=""
ARG NEXT_PUBLIC_API_BASE_URL=""
ARG ENABLE_SIGNALR="true"
ARG WPS_URL=""

# Set runtime environment variables for version tracking
ENV CONTAINER_IMAGE_TAG=${IMAGE_TAG}
ENV BUILD_TIME=${BUILD_TIME}
ENV BUILD_ID=${BUILD_ID}
ENV NEXT_PUBLIC_VERSION=${IMAGE_TAG}
ENV NEXT_PUBLIC_BUILD_TIME=${BUILD_TIME}
ENV NEXT_PUBLIC_BUILD_ID=${BUILD_ID}
# API_BASE_URL = Internal URL for server-side API routes (container-to-container)
ENV API_BASE_URL=${API_BASE_URL}
# NEXT_PUBLIC_API_BASE_URL = External URL for client-side browser calls
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_ENABLE_SIGNALR=${ENABLE_SIGNALR}
ENV NEXT_PUBLIC_WPS_URL=${WPS_URL}

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/build-info.json ./build-info.json

USER nextjs

EXPOSE 3000

ENV PORT=3000
# set hostname to localhost
ENV HOSTNAME="0.0.0.0"

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
CMD ["node", "server.js"]
