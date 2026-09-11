FROM node:20-alpine

WORKDIR /app
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev && apk add --no-cache postgresql-client

COPY --chown=node:node . .

RUN mkdir -p /app/runtime/data/backups /app/runtime/data/uploads /app/offsite-backups \
  && chown -R node:node /app/runtime /app/offsite-backups

ENV NODE_ENV=production \
    PORT=3000 \
    BYVIT_DATA_DIR=/app/runtime/data \
    BYVIT_BACKUP_DIR=/app/runtime/data/backups \
    BYVIT_UPLOAD_DIR=/app/runtime/data/uploads \
    BYVIT_STORAGE_PERSISTENT=true \
    BYVIT_MEDIA_PERSISTENT=true

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:3000/api/health >/dev/null || exit 1

CMD ["node", "server.js"]
