# Frontend build stage
FROM node:alpine as frontend-builder

WORKDIR /app/frontend
# Copy frontend package.json files
COPY frontend/package*.json ./
COPY frontend/config-overrides.js ./
RUN npm install

# Copy remaining frontend files
COPY frontend/ ./
RUN npm run build

# Backend build stage
FROM node:alpine

# Install language interpreters
RUN apk add --no-cache \
    python3 \
    nodejs \
    npm \
    openjdk11 \
    netcat-openbsd

# Set up TypeScript globally
RUN npm install -g typescript

# Create application structure
WORKDIR /app

# Copy built frontend
COPY --from=frontend-builder /app/frontend/build ./public

# Set up backend dependencies
COPY backend/package*.json ./
RUN npm install

# Copy backend code
COPY backend/ ./

# Open port
EXPOSE $PORT

# Run application
ENV NODE_ENV=production
CMD ["node", "server.js"]