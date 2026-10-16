import { existsSync, writeFileSync } from 'node:fs';
if (!existsSync('public/config.json'))
  writeFileSync('public/config.json', JSON.stringify({ supabaseUrl: '', supabaseAnonKey: '' }));
