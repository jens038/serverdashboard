# backend/Dockerfile

FROM node:20-alpine

WORKDIR /app

# Zorg dat data-map bestaat (wordt in docker-compose gemount op /app/data)
RUN mkdir -p /app/data

# Alleen backend dependencies
COPY backend/package*.json ./
RUN npm install --omit=dev

# Kopieer backend code (inclusief dist/ van de frontend build)
COPY backend/ ./

ENV NODE_ENV=production
ENV PORT=3232
ENV CONFIG_DIR=/app/data

EXPOSE 3232

CMD ["node", "server.js"]
