import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { SupabaseService } from './core/data/supabase.service';
import { AuthService } from './core/auth/auth.service';
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideAppInitializer(() => {
      const backend = inject(SupabaseService);
      const auth = inject(AuthService);
      return backend
        .initialize()
        .then(() => auth.initialize())
        .catch(() =>
          backend.initializationError.set(
            'No se pudo inicializar la conexión. Revisa la configuración y recarga la página.',
          ),
        );
    }),
  ],
};
