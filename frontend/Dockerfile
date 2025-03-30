FROM node:alpine

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all project files
COPY public/ ./public/
COPY src/ ./src/

# Open port
EXPOSE 3000

# Set environment variables for React
ENV CI=false
ENV NODE_ENV=development

# Run application
CMD ["npm", "start"]