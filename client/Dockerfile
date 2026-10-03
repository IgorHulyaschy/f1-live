# syntax=docker/dockerfile:1
#
# The client as static files behind Caddy, with the proxy to the relay. Build from the repository
# root; the VITE_* values are baked into the build, so one build serves one environment:
#   docker build -f client/Dockerfile --build-arg VITE_WS_URL=wss://app.example.com/live -t pitwall-web .

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY client/package.json client/
RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace shared --workspace client --include-workspace-root
COPY tsconfig.base.json ./
COPY shared shared
COPY client client
# Same-origin defaults: Caddy serves the saved sessions under /data and proxies /api and /live.
ARG VITE_DATA_SOURCE=api
ARG VITE_API_URL=/data
ARG VITE_WS_URL=ws://localhost:8080/live
ARG VITE_ACCOUNTS_URL=
ENV VITE_DATA_SOURCE=$VITE_DATA_SOURCE VITE_API_URL=$VITE_API_URL VITE_WS_URL=$VITE_WS_URL \
    VITE_ACCOUNTS_URL=$VITE_ACCOUNTS_URL
RUN npm run build --workspace client
COPY deploy/scripts/precompress.mjs deploy/scripts/
RUN node deploy/scripts/precompress.mjs client/dist

FROM caddy:2-alpine
COPY deploy/caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/client/dist /srv/app
# Caddy keeps no state here (no TLS, no admin API), so it can run as nobody.
USER 65534:65534
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
