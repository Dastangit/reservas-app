#!/usr/bin/env bash
# Instala (o actualiza) el respaldo diario de la base de reservas en esta PC.
#     deploy/pc/instalar-respaldo.sh
set -euo pipefail
aqui="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
destino="$HOME/.config/systemd/user"
mkdir -p "$destino" "$HOME/Dastan/respaldos/reservas"
chmod 700 "$HOME/Dastan/respaldos/reservas"
cp "$aqui/reservas-respaldo.service" "$aqui/reservas-respaldo.timer" "$destino/"
systemctl --user daemon-reload
systemctl --user enable --now reservas-respaldo.timer
systemctl --user list-timers reservas-respaldo.timer --no-pager
