FROM node:18-slim

WORKDIR /app

# Install required system deps for bcrypt + prisma + openssl
RUN apt-get update && apt-get install -y \
    openssl \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install ALL dependencies
RUN npm install

# Copy prisma schema first
COPY prisma ./prisma/

# Generate Prisma client
RUN npx prisma generate

# Copy rest of source code
COPY . .

# Cloud Run injects PORT=8080 automatically
ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "src/server.js"]