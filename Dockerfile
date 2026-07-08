# Stage 1: Build the app
FROM node:20

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Expose port 80
EXPOSE 8080

# Start nginx server
CMD ["npm", "run", "prod", "--", "--host"]
