FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy source
COPY . .

# Build
ARG NEXT_PUBLIC_DWARA_API_URL
ARG NEXT_PUBLIC_DWARA_ORIGIN
ENV NEXT_PUBLIC_DWARA_API_URL=$NEXT_PUBLIC_DWARA_API_URL
ENV NEXT_PUBLIC_DWARA_ORIGIN=$NEXT_PUBLIC_DWARA_ORIGIN

RUN npm run build

# Production stage
FROM node:18-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy built files
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public 2>/dev/null || true

EXPOSE 3001

ENV PORT=3001

CMD ["node", "server.js"]
