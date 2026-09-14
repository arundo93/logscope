#!/usr/bin/env bash
# =============================================================================
# Настройка firewall (ufw) для продакшен-сервера Logscope
#
# Политика:
#   - Наружу открыты ТОЛЬКО порты 80 (HTTP) и 443 (HTTPS) — через Caddy.
#   - SSH (22) — только для администрирования. Рекомендуется ограничить
#     источником (см. ниже) или использовать VPN/bastion.
#   - Всё остальное (включая 3000 app и 5432 postgres) закрыто извне.
#     Эти порты доступны только внутри docker-сетей.
#
# Запуск от root:
#   sudo bash deploy/firewall.sh
#
# ВАЖНО: перед запуском убедитесь, что у вас есть доступ к серверу по SSH
# (не заблокируйте сами себя). Если SSH на нестандартном порту — замените 22.
# =============================================================================
set -euo pipefail

echo "==> Включаем ufw (если не включён)"
ufw --force enable

echo "==> Политика по умолчанию: deny incoming, allow outgoing"
ufw default deny incoming
ufw default allow outgoing

echo "==> Разрешаем SSH (22/tcp)"
ufw allow 22/tcp comment 'SSH'

# Рекомендуется ограничить SSH источником (замените на ваш IP/подсеть):
#   ufw allow from 203.0.113.0/24 to any port 22 proto tcp comment 'SSH (restricted)'

echo "==> Разрешаем HTTP/HTTPS (80, 443) — через Caddy"
ufw allow 80/tcp comment 'HTTP (Caddy)'
ufw allow 443/tcp comment 'HTTPS (Caddy)'

echo "==> Явно закрываем порты приложения и БД извне (страховка)"
ufw deny 3000/tcp comment 'app (internal only)'
ufw deny 5432/tcp comment 'postgres (internal only)'

echo "==> Статус firewall:"
ufw status verbose

echo ""
echo "Готово. Наружу открыты только 22, 80, 443."
echo "Порт 3000 (app) и 5432 (postgres) доступны только внутри docker-сетей."