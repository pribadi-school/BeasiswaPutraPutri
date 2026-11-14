#!/bin/bash
# Dibuat oleh scripts/package.ts — jangan diubah di server.
# Memperbarui aplikasi: cd ~/repositories/beasiswa && git pull && bash deploy.sh
set -e
cd "$(dirname "$0")"
APP_ROOT="${PWD#$HOME/}"

# Lingkungan Node.js milik aplikasi (dibuat oleh cPanel → Setup Node.js App).
VENV=$(ls -d "$HOME/nodevenv/$APP_ROOT"/*/ 2>/dev/null | sort -V | tail -1)
if [ -z "$VENV" ]; then
  echo "✗ Aplikasi Node.js belum dibuat. cPanel → Setup Node.js App → Create Application,"
  echo "  Application root: $APP_ROOT, startup file: server/app.cjs (lihat README)."
  exit 1
fi
source "${VENV}bin/activate"

npm install --omit=dev --no-audit --no-fund
[ -f .env ] || echo "⚠ File .env belum ada. Buat dulu (lihat README), lalu jalankan deploy.sh lagi."
mkdir -p "$HOME/beasiswa-data/berkas" && chmod 700 "$HOME/beasiswa-data" "$HOME/beasiswa-data/berkas"

# Mulai ulang server (Passenger membaca tmp/restart.txt).
mkdir -p tmp && touch tmp/restart.txt
echo "✓ Diperbarui ke: $(git log -1 --format=%s 2>/dev/null || echo build)"
echo "  Server dimulai ulang. Cek: https://beasiswa.pribadidepok.sch.id/api/settings"
