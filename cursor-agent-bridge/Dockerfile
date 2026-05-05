FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY server/ ./server/
COPY src/ ./src/
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY index.html ./

RUN npm ci
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/package*.json ./

RUN npm ci --omit=dev

EXPOSE 3847

CMD ["node", "server/index.mjs"]
