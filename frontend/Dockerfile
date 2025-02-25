FROM node:alpine

WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем все файлы проекта
COPY public/ ./public/
COPY src/ ./src/

# Открываем порт
EXPOSE 3000

# Устанавливаем переменные окружения для React
ENV CI=false
ENV NODE_ENV=development

# Запускаем приложение
CMD ["npm", "start"]