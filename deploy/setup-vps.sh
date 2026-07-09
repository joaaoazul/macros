#!/usr/bin/env bash
# Instala/atualiza a app Macros num VPS Debian/Ubuntu com nginx (sem Docker).
# Primeira vez e atualizações: o mesmo comando.
#
#   sudo bash deploy/setup-vps.sh
#
# Variáveis opcionais:
#   REPO_URL  — origem do git (por omissão este repositório)
#   BRANCH    — branch a usar (por omissão main)
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/joaaoazul/macros.git}"
BRANCH="${BRANCH:-main}"
APP_DIR=/opt/macros
WEB_ROOT=/var/www/macros

if [ "$(id -u)" -ne 0 ]; then
  echo "Corre com sudo: sudo bash $0" >&2
  exit 1
fi

echo "==> Dependências (git, nginx, rsync, node 22)"
apt-get update -qq
apt-get install -y -qq git nginx rsync curl ca-certificates >/dev/null
if ! command -v node >/dev/null || [ "$(node -e 'console.log(process.versions.node.split(".")[0])')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
echo "    node $(node --version), nginx $(nginx -v 2>&1 | cut -d/ -f2)"

echo "==> Código ($REPO_URL @ $BRANCH)"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch origin "$BRANCH"
  git -C "$APP_DIR" checkout -B "$BRANCH" "origin/$BRANCH"
else
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

echo "==> Build"
cd "$APP_DIR"
npm ci --no-audit --no-fund
npm run build

echo "==> Publicar em $WEB_ROOT"
mkdir -p "$WEB_ROOT"
rsync -a --delete dist/ "$WEB_ROOT/"

echo "==> nginx"
cp "$APP_DIR/deploy/nginx-site.conf" /etc/nginx/sites-available/macros
ln -sf /etc/nginx/sites-available/macros /etc/nginx/sites-enabled/macros
# o site default do nginx também escuta na 80 com server_name _; remove-o para não haver conflito
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

IP=$(hostname -I 2>/dev/null | awk '{print $1}')
echo ""
echo "✅ Feito! A app está em http://${IP:-<ip-do-vps>}/"
echo "   Com domínio + HTTPS: edita server_name em /etc/nginx/sites-available/macros e corre:"
echo "   sudo apt install certbot python3-certbot-nginx && sudo certbot --nginx -d oteu.dominio.pt"
