FROM node:alpine

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all project files
COPY . ./

# Build production version with obfuscation
RUN npm run build

# Install serve to serve static files
RUN npm install -g serve

# Open port
EXPOSE 3000

# Set environment variables for React
ENV CI=false
ENV NODE_ENV=production

# Run application in production mode
CMD ["serve", "-s", "build", "-l", "3000"]