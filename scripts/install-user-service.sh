#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
node_bin="$(command -v node)"
herdr_bin="$(command -v herdr)"
service_dir="${XDG_CONFIG_HOME:-${HOME}/.config}/systemd/user"
application_dir="${XDG_DATA_HOME:-${HOME}/.local/share}/applications"
desktop_dir="$(xdg-user-dir DESKTOP 2>/dev/null || true)"
if [[ -z "${desktop_dir}" ]]; then
  desktop_dir="${HOME}/Desktop"
fi

mkdir -p "${service_dir}" "${application_dir}" "${desktop_dir}"

service_file="${service_dir}/pane-relay.service"
application_file="${application_dir}/pane-relay.desktop"
desktop_file="${desktop_dir}/Pane Relay.desktop"

sed \
  -e "s|@@PROJECT_DIR@@|${project_dir}|g" \
  -e "s|@@NODE_BIN@@|${node_bin}|g" \
  -e "s|@@HERDR_BIN@@|${herdr_bin}|g" \
  "${project_dir}/deploy/pane-relay.service.in" > "${service_file}"

sed \
  -e "s|@@PROJECT_DIR@@|${project_dir}|g" \
  "${project_dir}/deploy/pane-relay.desktop.in" > "${application_file}"
cp "${application_file}" "${desktop_file}"
chmod 700 "${project_dir}/scripts/open-pane-relay.sh"
chmod 700 "${desktop_file}"
gio set "${desktop_file}" metadata::trusted true >/dev/null 2>&1 || true

systemctl --user daemon-reload
systemctl --user enable --now pane-relay.service

printf 'Pane Relay 已安裝：%s\n' "${service_file}"
printf '桌面捷徑：%s\n' "${desktop_file}"
