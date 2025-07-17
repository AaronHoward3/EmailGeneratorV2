# Use Node.js 20 Alpine for smaller image size
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies for better performance
RUN apk add --no-cache dumb-init

# Copy package files first for better caching
COPY package.json yarn.lock ./

# Install dependencies with production optimizations
RUN yarn install --production=false --network-timeout 100000

# Copy source code
COPY . .

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 3000

# Health check with shorter intervals for faster detection
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Use dumb-init for proper signal handling and faster startup
ENTRYPOINT ["dumb-init", "--"]

# Start the application with Node.js optimizations
CMD ["node", "--max-old-space-size=3072", "--optimize-for-size", "src/server.js"] 