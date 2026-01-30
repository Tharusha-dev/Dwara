FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY backend/package*.json ./

# Copy prisma schema first (needed for package.json prisma config)
COPY prisma ./prisma/

# Install system dependencies
RUN apk add --no-cache openssl

# Install dependencies
RUN npm install

# Generate Prisma client
RUN npx prisma generate

# Copy backend application code
COPY backend/ ./

EXPOSE 4000

# Run migrations and start the server
CMD sh -c "npx prisma db push && npm start"
