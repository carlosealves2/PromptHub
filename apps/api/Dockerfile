FROM node:22-alpine AS builder

WORKDIR /app

COPY . .
RUN npm install
RUN npx nx build api

FROM node:22-alpine AS runner

WORKDIR /app

RUN npm install -g pm2

COPY --from=builder /app/apps/api/dist ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["pm2-runtime", "main.js"]
