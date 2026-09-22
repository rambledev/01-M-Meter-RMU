# syntax=docker/dockerfile:1
ARG NODE_VERSION=22-alpine

# ---- deps ----
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder ----
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN if grep -q "^model " prisma/schema.prisma; then npx prisma generate; fi
RUN npm run build

# ---- runner ----
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache openssl

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma Client + engines
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client

RUN mkdir -p public/upload/meter public/upload/doc \
  && chown -R nextjs:nodejs public/upload

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]