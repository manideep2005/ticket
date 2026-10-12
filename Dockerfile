# Stage 1: Build Frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production Server
FROM node:22-alpine
WORKDIR /app

# Install server dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# Copy server source code and built frontend static assets
COPY server/ ./server/
COPY --from=frontend-builder /app/dist ./dist

ENV PORT=8080
ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "--experimental-strip-types", "server/src/index.ts"]
