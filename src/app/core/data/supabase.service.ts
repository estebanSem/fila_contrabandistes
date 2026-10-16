import { Injectable, signal } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../models/database';
export interface PublicConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly initializationError = signal('');
  private client?: SupabaseClient<Database>;
  async initialize(): Promise<void> {
    const response = await fetch('/config.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('No se pudo cargar la configuración pública');
    const config: PublicConfig = await response.json();
    if (config.supabaseUrl && config.supabaseAnonKey) {
      const url = new URL(config.supabaseUrl);
      if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname))
        throw new Error('Configuración Supabase insegura');
      this.client = createClient<Database>(config.supabaseUrl, config.supabaseAnonKey, {
        auth: { flowType: 'pkce', detectSessionInUrl: true },
      });
    }
  }
  get configured(): boolean {
    return !!this.client;
  }
  get db(): SupabaseClient<Database> {
    if (!this.client) throw new Error('Configura Supabase antes de continuar');
    return this.client;
  }
}
