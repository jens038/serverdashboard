# -------------- FRONTEND BUILD STAGE --------------
FROM node:20-alpine AS frontend-build

WORKDIR /app

# Install frontend dependencies
COPY ../frontend/package*.json ./frontend/
RUN cd frontend && npm install

# Copy all frontend sources and build
COPY ../frontend ./frontend
RUN cd frontend && npm run build

# -------------- BACKEND RUNTIME STAGE --------------
FROM node:20-alpine

WORKDIR /app

# Install backend dependencies
COPY backend/package*.json ./
RUN npm install

# Copy backend code
COPY backend/server.js ./server.js

# Copy built frontend
COPY --from=frontend-build /app/frontend/dist ./dist

ENV NODE_ENV=production
ENV CONFIG_DIR=/app/data
ENV PORT=3232

EXPOSE 3232

CMD ["node", "server.js"]
