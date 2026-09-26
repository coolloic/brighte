# The API as a container image. Build from the repo root:
#   docker build -f apps/api/Dockerfile -t brighte-api .
# Runs dist/main.js; migrations and the dev seed run from the same image:
#   node dist/database/migrate.js up   ·   node dist/database/seed.js (refuses NODE_ENV=production)
FROM node:24-slim AS build
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/validation/package.json packages/validation/
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @brighte/api...
COPY packages/validation packages/validation
COPY apps/api apps/api
RUN pnpm --filter @brighte/validation build && pnpm --filter @brighte/api build
# Keep only production dependencies (workspace links stay, pointing at the built validation package).
RUN CI=true pnpm install --frozen-lockfile --ignore-scripts --prod --filter @brighte/api...

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build --chown=node:node /repo/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/packages/validation/package.json ./packages/validation/package.json
COPY --from=build --chown=node:node /repo/packages/validation/dist ./packages/validation/dist
COPY --from=build --chown=node:node /repo/packages/validation/node_modules ./packages/validation/node_modules
COPY --from=build --chown=node:node /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=node:node /repo/apps/api/dist ./apps/api/dist
WORKDIR /repo/apps/api
# The GraphQL schema is written to src/schema.gql at startup (autoSchemaFile).
RUN mkdir src && chown node:node src
USER node
EXPOSE 4001
CMD ["node", "dist/main.js"]
