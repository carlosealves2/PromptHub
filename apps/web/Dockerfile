FROM node:22-alpine AS builder

WORKDIR /app

COPY . .
RUN npm install
RUN npx nx build web

FROM node:22-alpine AS runner

WORKDIR /app

RUN npm install -g pm2

COPY --from=builder /app/apps/web/.output ./

ENV HOST=0.0.0.0
ENV PORT=3001

EXPOSE 3001

CMD ["pm2-runtime", "server/index.mjs"]
