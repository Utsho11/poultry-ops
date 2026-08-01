FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
RUN npm ci
RUN npm run build --workspace=@poultry-ops/types
RUN npm run build --workspace=@poultry-ops/validation
RUN npm run build --workspace=@poultry-ops/api

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/packages/ ./packages/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
RUN npm ci --only=production

EXPOSE 4000
CMD ["node", "apps/api/dist/server.js"]
