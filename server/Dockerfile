# syntax=docker/dockerfile:1
#
# One image for every MODE (all, ingest, relay) and for the one-shot commands (import, rebuild,
# replay-live). Build from the repository root:
#   docker build -f server/Dockerfile -t pitwall-server .

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace shared --workspace server --include-workspace-root
COPY tsconfig.base.json ./
COPY shared shared
COPY server/tsconfig.json server/tsconfig.build.json server/
COPY server/src server/src
RUN npx tsc -p server/tsconfig.build.json

FROM node:24-alpine AS runtime
# tini reaps child processes and passes SIGTERM on, so `docker stop` is a graceful shutdown.
RUN apk add --no-cache tini
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --workspace shared --workspace server
# The shared package is TypeScript that Node runs directly (type stripping), so it ships as source.
COPY shared/src shared/src
COPY --from=build /app/server/dist server/dist
COPY server/accounts-migrations server/accounts-migrations

# NODE_ENV is left to the deployment: production turns on the production rules for accounts.
ENV HOST=0.0.0.0 PORT=3000 DATA_DIR=/data
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server/dist/index.js"]
