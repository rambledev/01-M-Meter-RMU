# syntax=docker/dockerfile:1
ARG NODE_VERSION=22-alpine

# ---- deps: install exact locked dependencies ----
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: prisma generate + next build (standalone output) ----
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# No-op until Phase 1 adds real models to prisma/schema.prisma.
RUN if grep -q "^model " prisma/schema.prisma; then npx prisma generate; fi
RUN npm run build

# ---- runner: minimal production image ----
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
