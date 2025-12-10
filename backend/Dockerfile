# ---------- STAGE 1: frontend build ----------
FROM node:20-alpine AS frontend-build

WORKDIR /app

# 1) frontend deps
COPY frontend/package.json frontend/package-lock.json ./frontend/
WORKDIR /app/frontend
RUN npm ci

# 2) frontend build
COPY frontend/ ./
RUN npm run build

# ---------- STAGE 2: backend runtime ----------
FROM node:20-alpine

WORKDIR /app

# 1) backend deps
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

# 2) backend source + frontend dist
COPY backend/server.js ./
COPY --from=frontend-build /app/frontend/dist ./dist

# 3) data dir
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3232
ENV CONFIG_DIR=/app/data

EXPOSE 3232

CMD ["node", "server.js"]
