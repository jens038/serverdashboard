# ---------- STAGE 1: Frontend build ----------
FROM node:20-alpine AS frontend-build

WORKDIR /app

# 1) Frontend dependencies installeren
COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN npm install

# 2) Frontend broncode kopiëren en builden
COPY frontend/ ./
RUN npm run build

# ---------- STAGE 2: Backend + static frontend ----------
FROM node:20-alpine AS backend

WORKDIR /app

# Optioneel: build tools voor native modules (veilig om te hebben)
RUN apk add --no-cache python3 make g++

# 3) Backend dependencies installeren
COPY backend/package*.json ./
RUN npm install --omit=dev

# 4) Backend code kopiëren
COPY backend/ ./

# 5) Frontend build uit stage 1 naar ./dist
COPY --from=frontend-build /app/frontend/dist ./dist

# 6) Data-directory voor config
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3232
ENV CONFIG_DIR=/app/data

EXPOSE 3232

CMD ["node", "server.js"]
