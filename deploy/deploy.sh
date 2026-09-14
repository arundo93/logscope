#!/usr/bin/env bash
# =============================================================================
# Деплой Logscope в продакшен
#
# Шаги:
#   1. Проверяет наличие .env.production (секреты).
#   2. Проверяет обязательные переменные (ACCESS_KEY, POSTGRES_PASSWORD,
#      ALLOWED_ORIGINS). DOMAIN опционален: если пуст — доступ по IP (HTTP),
#      если задан — доступ по домену (HTTPS).
#   3. Собирает и запускает продакшен-стек (caddy + app + postgres).
#   4. Показывает статус и подсказку по firewall.
#
# Запуск из корня сервиса:
#   bash deploy/deploy.sh
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

ENV_FILE=".env.production"
COMPOSE="docker compose -f docker-compose.prod.yml --env-file ${ENV_FILE}"

echo "==> Проверяем наличие ${ENV_FILE}"
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "ОШИБКА: файл ${ENV_FILE} не найден."
  echo "Создайте его из шаблона:"
  echo "  cp .env.production.example ${ENV_FILE}"
  echo "  # и заполните DOMAIN, ACCESS_KEY, POSTGRES_PASSWORD, ALLOWED_ORIGINS"
  exit 1
fi

echo "==> Проверяем обязательные переменные"
# shellcheck disable=SC1090
source "${ENV_FILE}"
: "${ACCESS_KEY:?ACCESS_KEY не задан в ${ENV_FILE}}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD не задан в ${ENV_FILE}}"
: "${ALLOWED_ORIGINS:?ALLOWED_ORIGINS не задан в ${ENV_FILE}}"
# DOMAIN опционален: пуст → доступ по IP (HTTP), задан → доступ по домену (HTTPS).

echo "==> Проверяем, что ACCESS_KEY не содержит \$ (dotenv интерполирует)"
if [[ "${ACCESS_KEY}" == *'$'* ]]; then
  echo "ОШИБКА: ACCESS_KEY содержит символ \$. dotenv интерполирует \$VAR."
  echo "Используйте только буквы и цифры (A-Za-z0-9)."
  exit 1
fi

echo "==> Собираем и запускаем продакшен-стек"
${COMPOSE} up -d --build

echo "==> Статус контейнеров"
${COMPOSE} ps

echo ""
if [[ -n "${DOMAIN:-}" ]]; then
  echo "Готово. Сервис доступен на https://${DOMAIN}"
  echo "Вход: https://${DOMAIN}/login"
else
  echo "Готово. Сервис доступен по IP (HTTP, без TLS):"
  echo "  http://<IP-сервера>/"
  echo "  http://<IP-сервера>/login"
  echo ""
  echo "ПРИМЕЧАНИЕ: без домена TLS не используется (Let's Encrypt не выдаёт"
  echo "сертификаты на IP). Когда появится домен — задайте DOMAIN в"
  echo "${ENV_FILE} и перезапустите деплой."
fi
echo ""
echo "Не забудьте настроить firewall (от root):"
echo "  sudo bash deploy/firewall.sh"
echo ""
echo "Полезные команды:"
echo "  ${COMPOSE} logs -f caddy     # логи reverse proxy"
echo "  ${COMPOSE} logs -f app       # логи приложения"
echo "  ${COMPOSE} down              # остановить (данные сохраняются)"
echo "  ${COMPOSE} down -v           # остановить и удалить данные (осторожно!)"