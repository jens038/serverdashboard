# ========== BUILDER STAGE (frontend + backend) ==========
FROM node:20-alpine AS builder

WORKDIR /app

# ----- Install backend dependencies -----
COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev

# ----- Install frontend dependencies -----
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install

# ----- Copy full source -----
COPY backend ./backend
COPY frontend ./frontend

# ----- Build frontend -----
RUN cd frontend && npm run build

# ========== FINAL RUNTIME IMAGE ==========
FROM node:20-alpine

WORKDIR /app

# Copy backend
COPY --from=builder /app/backend ./

# Copy built frontend
COPY --from=builder /app/frontend/dist ./dist

ENV NODE_ENV=production
ENV PORT=3232
ENV CONFIG_DIR=/app/data

RUN mkdir -p /app/data

EXPOSE 3232

CMD ["node", "server.js"]
