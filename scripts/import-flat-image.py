"""Import a verified OCI filesystem into Docker without accumulating VFS layers.

Input tar/config must come from the same digest-pinned image via crane.
This changes the local image manifest, never its upstream registry.
"""
import json
import subprocess
import sys

config_path, tar_path, tag, digest = sys.argv[1:]
config = json.load(open(config_path, encoding='utf-8'))['config']
args = ['docker', 'import']
for entry in config.get('Env', []):
    args += ['--change', f'ENV {entry}']
for key in ['Entrypoint', 'Cmd', 'WorkingDir', 'User', 'StopSignal']:
    value = config.get(key)
    if value:
        instruction = {'Entrypoint': 'ENTRYPOINT', 'Cmd': 'CMD', 'WorkingDir': 'WORKDIR', 'User': 'USER', 'StopSignal': 'STOPSIGNAL'}[key]
        args += ['--change', f'{instruction} {json.dumps(value) if isinstance(value, list) else value}']
for port in config.get('ExposedPorts', {}):
    args += ['--change', f'EXPOSE {port}']
for name, value in config.get('Labels', {}).items():
    args += ['--change', f'LABEL {name}={json.dumps(value)}']
args += ['--change', f'LABEL local.fila.source-digest={digest}', '--change', 'LABEL local.fila.flattened=true', tar_path, tag]
subprocess.run(args, check=True)
# The CLI supplies its own healthcheck. No image is published or pushed.
