FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN addgroup -S shogun && adduser -S shogun -G shogun
COPY --from=build --chown=shogun:shogun /app/package*.json ./
COPY --from=build --chown=shogun:shogun /app/node_modules ./node_modules
COPY --from=build --chown=shogun:shogun /app/dist ./dist
COPY --from=build --chown=shogun:shogun /app/server.ts ./
COPY --from=build --chown=shogun:shogun /app/backend ./backend
USER shogun
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --retries=3 CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/metrics || exit 1
CMD ["node", "--loader", "tsx", "server.ts"]
