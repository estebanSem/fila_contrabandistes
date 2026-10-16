#!/usr/bin/env bash
set -euo pipefail
# Supabase's layered image exceeds disk capacity under Docker VFS.
# Merge its verified official layers once; do not change the upstream registry.
image=supabase/postgres:17.6.1.075
if docker image inspect "$image" >/dev/null 2>&1; then exit 0; fi
if [[ "$(docker info --format '{{.Driver}}')" != vfs ]]; then exit 0; fi
repo_dir=$(cd "$(dirname "$0")/.." && pwd)
tool_dir=/workspace/.tools/bin
mkdir -p "$tool_dir"
scratch_dir=$(mktemp -d)
trap 'rm -rf "$scratch_dir"' EXIT
if [[ ! -x "$tool_dir/crane" ]]; then
  case "$(uname -m)" in x86_64) arch=x86_64 ;; aarch64) arch=arm64 ;; *) exit 1 ;; esac
  archive="go-containerregistry_Linux_${arch}.tar.gz"
  base=https://github.com/google/go-containerregistry/releases/download/v0.20.3
  curl -fsSL "$base/checksums.txt" -o "$scratch_dir/checksums.txt"
  curl -fsSL "$base/$archive" -o "$scratch_dir/$archive"
  (cd "$scratch_dir"; awk -v name="$archive" '$2==name {print}' checksums.txt > selected.txt; test -s selected.txt; sha256sum --check selected.txt)
  tar -xzf "$scratch_dir/$archive" -C "$tool_dir" crane
fi
source_image=registry-1.docker.io/supabase/postgres:17.6.1.075
digest=$("$tool_dir/crane" digest "$source_image")
pinned="registry-1.docker.io/supabase/postgres@$digest"
"$tool_dir/crane" config "$pinned" > "$scratch_dir/config.json"
"$tool_dir/crane" export "$pinned" "$scratch_dir/rootfs.tar"
python3 "$repo_dir/scripts/import-flat-image.py" "$scratch_dir/config.json" "$scratch_dir/rootfs.tar" "$image" "$digest"
