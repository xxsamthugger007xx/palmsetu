# ---- build stage: compile TypeScript, then keep only production dependencies ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
# better-sqlite3 and sharp are native modules; these tools let npm build them if no prebuilt binary matches.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ---- runtime stage ----
FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PORT=4000 \
    DATA_DIR=/data \
    TRUST_PROXY=true
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends gosu curl && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY public ./public
COPY package.json ./
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && mkdir -p /data && chown node:node /data
VOLUME ["/data"]
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD curl -fsS http://localhost:${PORT}/health || exit 1
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
