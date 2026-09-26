# The web app as a container image (Next.js standalone output). Build from the repo root:
#   docker build -f apps/web/Dockerfile -t brighte-web .
# Runtime settings are environment variables: API_URL, SITE_URL, WEB_TRUST_PROXY, PORT.
FROM node:24-slim AS build
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/validation/package.json packages/validation/
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @brighte/web...
COPY packages/validation packages/validation
COPY apps/web apps/web
ENV NEXT_OUTPUT=standalone NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @brighte/validation build && pnpm --filter @brighte/web build

FROM node:24-slim
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3001 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3001
CMD ["node", "apps/web/server.js"]
