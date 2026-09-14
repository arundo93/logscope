#!/usr/bin/env bash
# =============================================================================
# Хардненинг SSH: доступ только по ключу (без пароля)
#
# Что делает:
#   1. Проверяет, что у пользователя есть SSH-ключ (иначе вы заблокируете себя).
#   2. Отключает вход по паролю (PasswordAuthentication no).
#   3. Отключает вход root по паролю (PermitRootLogin prohibit-password).
#   4. Включает PubkeyAuthentication.
#   5. Перезапускает sshd.
#
# ВАЖНО: запускайте ТОЛЬКО после того, как добавили свой публичный ключ в
# ~/.ssh/authorized_keys и проверили, что вход по ключу работает из другого
# терминала. Иначе вы потеряете доступ к серверу.
#
# Запуск от root:
#   sudo bash deploy/ssh_hardening.sh
# =============================================================================
set -euo pipefail

SSHD_CONFIG="/etc/ssh/sshd_config"
SSHD_CONFIG_DIR="/etc/ssh/sshd_config.d"

echo "==> Проверяем наличие SSH-ключей у текущего пользователя"
if [[ ! -f "${HOME}/.ssh/authorized_keys" ]] || [[ ! -s "${HOME}/.ssh/authorized_keys" ]]; then
  echo "ОШИБКА: ${HOME}/.ssh/authorized_keys пуст или отсутствует."
  echo "Сначала добавьте свой публичный ключ:"
  echo "  mkdir -p ~/.ssh && chmod 700 ~/.ssh"
  echo "  echo 'ssh-ed25519 AAAA... ваш-ключ' >> ~/.ssh/authorized_keys"
  echo "  chmod 600 ~/.ssh/authorized_keys"
  echo "Затем проверьте вход по ключу из другого терминала и повторите скрипт."
  exit 1
fi

echo "==> Проверяем, что вход по ключу уже работает (иначе не продолжаем)"
if ! ssh -o BatchMode=yes -o ConnectTimeout=5 "localhost" true 2>/dev/null; then
  echo "ОШИБКА: вход по ключу на localhost не работает."
  echo "Не продолжаем, чтобы не заблокировать доступ. Проверьте ключи и повторите."
  exit 1
fi

echo "==> Применяем настройки SSH"
# Используем drop-in каталог, если он поддерживается (Ubuntu/Debian).
if [[ -d "${SSHD_CONFIG_DIR}" ]]; then
  HARDENING_FILE="${SSHD_CONFIG_DIR}/99-hardening.conf"
  cat > "${HARDENING_FILE}" <<'EOF'
# --- Хардненинг SSH: доступ только по ключу ---
PasswordAuthentication no
PermitRootLogin prohibit-password
PubkeyAuthentication yes
ChallengeResponseAuthentication no
UsePAM no
EOF
  chmod 600 "${HARDENING_FILE}"
  echo "Записан ${HARDENING_FILE}"
else
  # Fallback: правим основной конфиг.
  sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' "${SSHD_CONFIG}"
  sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' "${SSHD_CONFIG}"
  sed -i 's/^#\?PubkeyAuthentication.*/PubkeyAuthentication yes/' "${SSHD_CONFIG}"
  echo "Обновлён ${SSHD_CONFIG}"
fi

echo "==> Проверяем синтаксис конфига"
sshd -t

echo "==> Перезапускаем sshd"
systemctl restart sshd || service ssh restart

echo ""
echo "Готово. SSH теперь принимает только вход по ключу."
echo "Проверьте из другого терминала: ssh user@<server>"
echo "Если что-то пошло не так — у вас есть открытая сессия, восстановите доступ."