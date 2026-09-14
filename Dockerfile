# --- Build stage ---
FROM node:20-alpine AS builder
WORKDIR /app

# Копируем манифесты зависимостей
COPY package.json package-lock.json* ./
COPY prisma ./prisma

# Устанавливаем зависимости
RUN npm install

# Копируем исходники
COPY . .

# Генерируем Prisma client и собираем Next.js
RUN npx prisma generate
RUN npm run build

# --- Runtime stage ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Копируем standalone-сборку Next.js
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
# Prisma client (сгенерированный) для runtime
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# Prisma CLI для применения миграций при старте
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
# Создаём симлинк .bin/prisma → prisma/build/index.js (как это делает npm).
# Копировать .bin/prisma как обычный файл нельзя: тогда Prisma CLI ищет свои
# wasm-файлы (prisma_schema_build_bg.wasm) в /app/node_modules/.bin/ и падает
# с ENOENT. Симлинк заставляет Node.js резолвить реальный путь, и wasm
# находится корректно в node_modules/@prisma/prisma-schema-wasm/.
RUN mkdir -p /app/node_modules/.bin \
    && ln -s /app/node_modules/prisma/build/index.js /app/node_modules/.bin/prisma

# --- Хардненинг: запуск от непривилегированного пользователя ---
# В node:alpine уже есть пользователь `node` (uid 1000). Отдаём ему владение
# рабочим каталогом, чтобы standalone-сборка могла писать в /app (кэш, tmp).
RUN chown -R node:node /app

# Переключаемся на непривилегированного пользователя.
# ВАЖНО: при запуске через docker-compose.prod.yml контейнер дополнительно
# запускается с read_only: true и cap_drop: ALL — см. compose-файл.
USER node

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Применяем миграции и запускаем сервер.
# Prisma CLI вызываем напрямую через node (не через npx), чтобы гарантированно
# использовать локальный бинарник и не зависеть от резолва npx.
CMD ["sh", "-c", "node /app/node_modules/prisma/build/index.js migrate deploy && node server.js"]