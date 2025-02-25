# Этап сборки фронтенда
FROM node:alpine as frontend-builder

WORKDIR /app/frontend
# Копируем файлы package.json фронтенда
COPY frontend/package*.json ./
COPY frontend/config-overrides.js ./
RUN npm install

# Копируем остальные файлы фронтенда
COPY frontend/ ./
RUN npm run build
RUN echo "Frontend build contents:"
RUN ls -la build/

# Этап сборки бэкенда
FROM node:alpine

# Устанавливаем интерпретаторы языков
RUN apk add --no-cache \
    python3 \
    nodejs \
    npm \
    openjdk11 \
    netcat-openbsd

# Устанавливаем TypeScript глобально
RUN npm install -g typescript

# Создаем структуру приложения
WORKDIR /app

# Копируем собранный фронтенд
COPY --from=frontend-builder /app/frontend/build ./public
RUN echo "Public directory contents:"
RUN ls -la public/

# Устанавливаем зависимости бэкенда
COPY backend/package*.json ./
RUN npm install

# Копируем код бэкенда
COPY backend/ ./

# Открываем порт
EXPOSE $PORT

# Запускаем приложение
ENV NODE_ENV=production
CMD ["node", "server.js"]