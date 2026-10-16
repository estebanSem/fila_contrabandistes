#!/usr/bin/env bash
set -euo pipefail
# Instala el CLI sin modificar HOME; conserva TLS y verifica el checksum oficial.
version=2.75.0
target="${SUPABASE_CLI_DIR:-/workspace/.tools/supabase-2.75.0}"
if [[ -x "$target/supabase" ]] && [[ "$("$target/supabase" --version 2>/dev/null)" == "$version" ]]; then
  exit 0
fi
case "$(uname -m)" in x86_64) arch=amd64 ;; aarch64) arch=arm64 ;; *) echo 'Arquitectura no soportada' >&2; exit 1 ;; esac
archive="supabase_linux_${arch}.tar.gz"
scratch_dir=$(mktemp -d)
trap 'rm -rf "$scratch_dir"' EXIT
base="https://github.com/supabase/cli/releases/download/v${version}"
curl --fail --location --silent --show-error "$base/supabase_${version}_checksums.txt" -o "$scratch_dir/checksums.txt"
curl --fail --location --silent --show-error "$base/$archive" -o "$scratch_dir/$archive"
(cd "$scratch_dir"; awk -v name="$archive" '$2==name {print}' checksums.txt > selected.txt; test -s selected.txt; sha256sum --check selected.txt)
mkdir -p "$target"
tar -xzf "$scratch_dir/$archive" -C "$target" supabase
"$target/supabase" --version
