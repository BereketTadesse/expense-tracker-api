# ==========================================
# 1. Build Stage
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies (including devDependencies for building)
RUN npm ci

# Copy source code and config files
COPY . .

# Build the NestJS application
RUN npm run build

# Prune devDependencies to keep image small
RUN npm prune --production

# ==========================================
# 2. Production Stage
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy node_modules and built dist from builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Copy entrypoint script and set executable permissions
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Run as non-root user for security
USER node

# Expose app port
EXPOSE 3000

# Set entrypoint script and default start command
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
