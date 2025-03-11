.PHONY: setup install start stop logs clean rebuild test deploy help dev watch-logs

# Переменные
DOCKER_IMAGES = python:alpine node:alpine openjdk11:alpine
BACKEND_PORT = 5001
FRONTEND_PORT = 3000
APP_NAME = livecoding

# Цвета для вывода
CYAN = \033[0;36m
GREEN = \033[0;32m
YELLOW = \033[0;33m
RED = \033[0;31m
NC = \033[0m # No Color

# Команды разработки
dev: ## Запуск в режиме разработки (и фронтенд, и бэкенд)
	@echo "$(CYAN)Запуск в режиме разработки...$(NC)"
	@make -j2 dev-backend dev-frontend

dev-backend: ## Запуск только бэкенда в режиме разработки
	@echo "$(CYAN)Запуск бэкенда на порту $(BACKEND_PORT)...$(NC)"
	@cd backend && npm run dev

dev-frontend: ## Запуск только фронтенда в режиме разработки
	@echo "$(CYAN)Запуск фронтенда на порту $(FRONTEND_PORT)...$(NC)"
	@cd frontend && BROWSER=none npm start

install: ## Установка зависимостей
	@echo "$(CYAN)Установка зависимостей бэкенда...$(NC)"
	@cd backend && npm install
	@echo "$(CYAN)Установка зависимостей фронтенда...$(NC)"
	@cd frontend && npm install
	@echo "$(GREEN)Зависимости установлены!$(NC)"

# Команды сборки
build: ## Сборка проекта
	@echo "$(CYAN)Сборка фронтенда...$(NC)"
	@cd frontend && npm run build
	@echo "$(GREEN)Сборка завершена!$(NC)"

# Команды для Docker
docker-build: ## Сборка Docker образов
	@echo "$(CYAN)Сборка Docker образов...$(NC)"
	@docker-compose build

docker-up: ## Запуск в Docker
	@echo "$(CYAN)Запуск в Docker...$(NC)"
	@docker-compose up -d

docker-down: ## Остановка Docker контейнеров
	@echo "$(CYAN)Остановка контейнеров...$(NC)"
	@docker-compose down

docker-logs: ## Просмотр логов Docker
	@docker-compose logs -f

docker-clean: ## Очистка Docker ресурсов
	@echo "$(YELLOW)Очистка Docker ресурсов...$(NC)"
	@docker system prune -af
	@echo "$(GREEN)Docker ресурсы очищены!$(NC)"

# Команды для Heroku
heroku-deploy: ## Деплой на Heroku
	@echo "$(CYAN)Деплой на Heroku...$(NC)"
	@git push heroku main --force

heroku-logs: ## Просмотр логов Heroku
	@heroku logs --tail -a $(APP_NAME)

heroku-clean: ## Очистка кэша сборки Heroku
	@echo "$(CYAN)Очистка кэша Heroku...$(NC)"
	@heroku builds:clear

# Команды для тестирования
test: ## Запуск тестов
	@echo "$(CYAN)Запуск тестов фронтенда...$(NC)"
	@cd frontend && npm test
	@echo "$(CYAN)Запуск тестов бэкенда...$(NC)"
	@cd backend && npm test

lint: ## Проверка кода линтером
	@echo "$(CYAN)Проверка кода...$(NC)"
	@cd frontend && npm run lint
	@cd backend && npm run lint

# Утилиты
clean: ## Очистка проекта
	@echo "$(CYAN)Очистка проекта...$(NC)"
	@rm -rf frontend/node_modules backend/node_modules
	@rm -rf frontend/build backend/dist
	@make docker-clean
	@echo "$(GREEN)Проект очищен!$(NC)"

# Мониторинг и отладка
status: ## Проверка статуса сервисов
	@echo "$(CYAN)Статус Docker контейнеров:$(NC)"
	@docker-compose ps
	@echo "\n$(CYAN)Статус портов:$(NC)"
	@lsof -i:$(BACKEND_PORT) || echo "Порт $(BACKEND_PORT) свободен"
	@lsof -i:$(FRONTEND_PORT) || echo "Порт $(FRONTEND_PORT) свободен"

logs: ## Просмотр всех логов
	@echo "$(CYAN)Выберите тип логов:$(NC)"
	@echo "1. make docker-logs  - Логи Docker"
	@echo "2. make heroku-logs  - Логи Heroku"
	@echo "3. make dev-logs     - Логи разработки"

dev-logs: ## Просмотр логов разработки
	@make -j2 dev-backend-logs dev-frontend-logs

dev-backend-logs: ## Просмотр логов бэкенда
	@cd backend && npm run dev | grep -v "webpack"

dev-frontend-logs: ## Просмотр логов фронтенда
	@cd frontend && npm start | grep -v "webpack"

# Помощь
help: ## Показать это сообщение
	@echo "$(CYAN)Доступные команды:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(CYAN)%-20s$(NC) %s\n", $$1, $$2}'

# Проверка зависимостей
check-deps: ## Проверка установленных зависимостей
	@echo "$(CYAN)Проверка зависимостей...$(NC)"
	@which node || echo "$(RED)Node.js не установлен$(NC)"
	@which npm || echo "$(RED)npm не установлен$(NC)"
	@which docker || echo "$(RED)Docker не установлен$(NC)"
	@which docker-compose || echo "$(RED)Docker Compose не установлен$(NC)"
	@which heroku || echo "$(RED)Heroku CLI не установлен$(NC)"

# По умолчанию
.DEFAULT_GOAL := help