FROM node:25-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY src ./src
RUN mkdir -p /app/data

ENV POLL_DATA_DIR=/app/data
CMD ["npm", "run", "bot:start"]
