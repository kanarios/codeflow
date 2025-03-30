.PHONY: setup install start stop logs clean rebuild test deploy help dev watch-logs

# Variables
DOCKER_IMAGES = python:alpine node:alpine openjdk11:alpine
BACKEND_PORT = 5001
FRONTEND_PORT = 3000
APP_NAME = livecoding

# Colors for output
CYAN = \033[0;36m
GREEN = \033[0;32m
YELLOW = \033[0;33m
RED = \033[0;31m
NC = \033[0m # No Color

# Development commands
dev: ## Run in development mode (both frontend and backend)
	@echo "$(CYAN)Starting development mode...$(NC)"
	@make -j2 dev-backend dev-frontend

dev-backend: ## Run only backend in development mode
	@echo "$(CYAN)Starting backend on port $(BACKEND_PORT)...$(NC)"
	@cd backend && npm run dev

dev-frontend: ## Run only frontend in development mode
	@echo "$(CYAN)Starting frontend on port $(FRONTEND_PORT)...$(NC)"
	@cd frontend && BROWSER=none npm start

install: ## Install dependencies
	@echo "$(CYAN)Installing backend dependencies...$(NC)"
	@cd backend && npm install
	@echo "$(CYAN)Installing frontend dependencies...$(NC)"
	@cd frontend && npm install
	@echo "$(GREEN)Dependencies installed!$(NC)"

# Build commands
build: ## Build project
	@echo "$(CYAN)Building frontend...$(NC)"
	@cd frontend && npm run build
	@echo "$(GREEN)Build complete!$(NC)"

# Commands for Docker
docker-build: ## Build Docker images
	@echo "$(CYAN)Building Docker images...$(NC)"
	@docker-compose build

docker-up: ## Run in Docker
	@echo "$(CYAN)Running in Docker...$(NC)"
	@docker-compose up -d

docker-down: ## Stop Docker containers
	@echo "$(CYAN)Stopping containers...$(NC)"
	@docker-compose down

docker-logs: ## View Docker logs
	@docker-compose logs -f

docker-clean: ## Clean Docker resources
	@echo "$(YELLOW)Cleaning Docker resources...$(NC)"
	@docker system prune -af
	@echo "$(GREEN)Docker resources cleaned!$(NC)"

# Commands for testing
test: ## Run tests
	@echo "$(CYAN)Running frontend tests...$(NC)"
	@cd frontend && npm test
	@echo "$(CYAN)Running backend tests...$(NC)"
	@cd backend && npm test

lint: ## Check code with linter
	@echo "$(CYAN)Checking code...$(NC)"
	@cd frontend && npm run lint
	@cd backend && npm run lint

# Utilities
clean: ## Clean project
	@echo "$(CYAN)Cleaning project...$(NC)"
	@rm -rf frontend/node_modules backend/node_modules
	@rm -rf frontend/build backend/dist
	@make docker-clean
	@echo "$(GREEN)Project cleaned!$(NC)"

# Monitoring and debugging
status: ## Check status of services
	@echo "$(CYAN)Docker containers status:$(NC)"
	@docker-compose ps
	@echo "\n$(CYAN)Ports status:$(NC)"
	@lsof -i:$(BACKEND_PORT) || echo "Port $(BACKEND_PORT) is free"
	@lsof -i:$(FRONTEND_PORT) || echo "Port $(FRONTEND_PORT) is free"

logs: ## View all logs
	@echo "$(CYAN)Choose log type:$(NC)"
	@echo "1. make docker-logs  - Docker logs"
	@echo "3. make dev-logs     - Development logs"

dev-logs: ## View development logs
	@make -j2 dev-backend-logs dev-frontend-logs

dev-backend-logs: ## View backend logs
	@cd backend && npm run dev | grep -v "webpack"

dev-frontend-logs: ## View frontend logs
	@cd frontend && npm start | grep -v "webpack"

# Help
help: ## Show this message
	@echo "$(CYAN)Available commands:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(CYAN)%-20s$(NC) %s\n", $$1, $$2}'

# Check dependencies
check-deps: ## Check installed dependencies
	@echo "$(CYAN)Checking dependencies...$(NC)"
	@which node || echo "$(RED)Node.js is not installed$(NC)"
	@which npm || echo "$(RED)npm is not installed$(NC)"
	@which docker || echo "$(RED)Docker is not installed$(NC)"
	@which docker-compose || echo "$(RED)Docker Compose is not installed$(NC)"

# Default goal
.DEFAULT_GOAL := help