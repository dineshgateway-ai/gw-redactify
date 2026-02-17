# Use Node.js 20 slim image
FROM node:22-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Expose port 3000
EXPOSE 3000

# Start the application in development mode
# We use --host to allow external access (from outside the container)
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
