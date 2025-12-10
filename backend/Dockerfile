# ---------- STAGE 1: Frontend build ----------
FROM node:20-alpine AS frontend-build

WORKDIR /app

# Alleen frontend deps
COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN npm install

# Kopieer frontend broncode en build
COPY frontend/ ./
RUN npm run build

# ---------- STAGE 2: Backend + static frontend ----------
FROM node:20-alpine AS backend

WORKDIR /app

# Nodig voor sommige Node modules (veilig om te hebben)
RUN apk add --no-cache python3 make g++

# Backend dependencies
COPY backend/package*.json ./
RUN npm install --omit=dev

# Kopieer backend code
COPY backend/ ./

# Kopieer frontend build naar ./dist in backend
COPY --from=frontend-build /app/frontend/dist ./dist

# Zorg dat data-map bestaat (wordt in docker-compose gemount op /app/data)
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3232
ENV CONFIG_DIR=/app/data

EXPOSE 3232

CMD ["node", "server.js"]
