FROM node:24-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV PORT=3020
ENV DB_PATH=/data/arena.db
ENV BACKUPS_DIR=/data/backups
ENV AUTO_BACKUP_ON_START=true
ENV AUTO_BACKUP_INTERVAL_HOURS=24
ENV BACKUP_RETENTION=30

RUN mkdir -p /data

EXPOSE 3020

CMD ["npm", "start"]
