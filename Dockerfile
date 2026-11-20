# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=22
ARG PNPM_VERSION=11.1.3

# ---------- base ----------
FROM node:${NODE_VERSION}-alpine AS base
ARG PNPM_VERSION
RUN apk add --no-cache libc6-compat \
 && npm install -g pnpm@${PNPM_VERSION}
WORKDIR /app

# ---------- deps ----------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store

# ---------- builder ----------
FROM deps AS builder
COPY . .

# Публичные переменные вшиваются в клиентский бандл при сборке
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG NEXT_PUBLIC_YM_ID=
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_YM_ID=$NEXT_PUBLIC_YM_ID \
    NEXT_TELEMETRY_DISABLED=1

# БД при сборке нет. Секреты сюда не передаются; фиктивные значения живут только в этом RUN.
RUN BETTER_AUTH_SECRET=build-only-secret-build-only-secret-0000 \
    BETTER_AUTH_URL=http://localhost:3000 \
    pnpm build \
 && pnpm build:migrate

# ---------- runner ----------
FROM node:${NODE_VERSION}-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    UPLOAD_DIR=/data/uploads

# каталог загрузок создаётся в образе и принадлежит node:
# именованный volume наследует владельца при первом монтировании
RUN mkdir -p /data/uploads && chown -R node:node /data

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/drizzle ./drizzle
COPY --from=builder --chown=node:node /app/dist/migrate.cjs ./migrate.cjs
COPY --chown=node:node --chmod=0755 docker-entrypoint.sh ./docker-entrypoint.sh
RUN sed -i 's/\r$//' ./docker-entrypoint.sh

USER node
VOLUME ["/data/uploads"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/api/health" || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
