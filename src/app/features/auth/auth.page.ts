import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ErrorState } from '../../shared/ui';
@Component({
  standalone: true,
  imports: [ReactiveFormsModule, ErrorState],
  template: ` <section class="auth-card" aria-labelledby="auth-title">
    <p class="eyebrow">FILÀ · ESPACIO DE GESTIÓN</p>
    <h1 id="auth-title">
      {{
        auth.recovery()
          ? 'Nueva contraseña'
          : resetMode()
            ? 'Recupera tu acceso'
            : 'Bienvenido a tu filà'
      }}
    </h1>
    <p>Un lugar para cuidar de nuestra comunidad.</p>
    @if (!auth.backend.configured) {
      <p class="error" role="alert">
        Falta la configuración de Supabase. Consulta la instalación en README.
      </p>
    }
    <form [formGroup]="form" (ngSubmit)="submit()">
      @if (!auth.recovery()) {
        <label
          >Correo electrónico<input
            type="email"
            formControlName="email"
            autocomplete="username"
            required
        /></label>
      }
      @if (!resetMode() || auth.recovery()) {
        <label
          >Contraseña<input
            type="password"
            formControlName="password"
            [attr.autocomplete]="auth.recovery() ? 'new-password' : 'current-password'"
        /></label>
      }
      <app-error-state [message]="error()" />
      @if (message()) {
        <p role="status">{{ message() }}</p>
      }
      <button class="primary" [disabled]="busy() || !auth.backend.configured">
        {{
          busy()
            ? 'Procesando…'
            : auth.recovery()
              ? 'Guardar contraseña'
              : resetMode()
                ? 'Enviar enlace'
                : 'Entrar'
        }}
      </button>
    </form>
    @if (!auth.recovery()) {
      <button class="text-button" (click)="resetMode.set(!resetMode()); error.set('')">
        {{ resetMode() ? 'Volver al acceso' : 'He olvidado mi contraseña' }}
      </button>
    }
  </section>`,
})
export class AuthPage {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: [''],
  });
  readonly resetMode = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  async submit(): Promise<void> {
    this.error.set('');
    this.message.set('');
    const { email, password } = this.form.getRawValue();
    if (!this.auth.recovery() && this.form.controls.email.invalid) {
      this.error.set('Introduce un correo válido.');
      return;
    }
    if (
      (!this.resetMode() || this.auth.recovery()) &&
      password.length < (this.auth.recovery() ? 12 : 1)
    ) {
      this.error.set('Revisa la contraseña (mínimo 12 caracteres al restablecerla).');
      return;
    }
    this.busy.set(true);
    try {
      if (this.auth.recovery()) {
        await this.auth.changePassword(password);
        await this.router.navigateByUrl('/');
      } else if (this.resetMode()) {
        await this.auth.reset(email);
        this.message.set(
          'Si la cuenta existe, recibirás instrucciones en tu correo. Abre el enlace en este mismo navegador.',
        );
      } else {
        await this.auth.login(email, password);
        await this.router.navigateByUrl('/');
      }
    } catch {
      this.error.set(
        'No se pudo completar la operación. Comprueba tus datos o inténtalo de nuevo.',
      );
    } finally {
      this.busy.set(false);
    }
  }
}
