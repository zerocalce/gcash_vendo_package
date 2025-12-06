FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY backend/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY backend/ .

# Create data directory
RUN mkdir -p data

# Expose port
EXPOSE 8080

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Start the application
CMD ["npm", "start"]
