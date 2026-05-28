#!/usr/bin/env bash
set -euo pipefail

APP_DIR=/opt/picap
DATA_DIR=/var/lib/picap
ENV_DIR=/env
ENV_FILE=${ENV_DIR}/picap.env
SERVICE_USER=picap

if [[ ${EUID} -ne 0 ]]; then
  echo "Run as root: sudo scripts/install.sh" >&2
  exit 1
fi

apt-get update
apt-get install -y nodejs npm tcpdump network-manager python3 make g++

if ! command -v pnpm >/dev/null 2>&1; then
  corepack enable
  corepack prepare pnpm@10.33.4 --activate
fi

id "${SERVICE_USER}" >/dev/null 2>&1 || useradd --system --home "${DATA_DIR}" --shell /usr/sbin/nologin "${SERVICE_USER}"
mkdir -p "${APP_DIR}" "${DATA_DIR}/captures" "${DATA_DIR}/logs" "${ENV_DIR}"
rsync -a --delete --exclude node_modules --exclude dist --exclude data --exclude .env ./ "${APP_DIR}/"
if [[ ! -f "${ENV_FILE}" ]]; then
  cp "${APP_DIR}/.env.example" "${ENV_FILE}"
fi
chown root:"${SERVICE_USER}" "${ENV_FILE}"
chmod 0640 "${ENV_FILE}"
chown -R "${SERVICE_USER}:${SERVICE_USER}" "${DATA_DIR}"

cd "${APP_DIR}"
pnpm install --prod=false --frozen-lockfile
pnpm run build

install -m 0644 systemd/picap.service /etc/systemd/system/picap.service
cat >/etc/sudoers.d/picap <<'SUDOERS'
picap ALL=(root) NOPASSWD: /usr/bin/tcpdump, /usr/bin/nmcli
SUDOERS
chmod 0440 /etc/sudoers.d/picap

systemctl daemon-reload
echo "Set PICAP_PASSWORD_HASH and PICAP_SESSION_SECRET in ${ENV_FILE}, then run:"
echo "  systemctl enable --now picap"
