import { afterNextRender, Component, ElementRef, input, output, viewChild } from '@angular/core';
@Component({
  selector: 'app-page-header',
  template: `<header class="page-header">
    <p class="eyebrow">GESTIÓN DE LA FILÀ</p>
    <h1>{{ title() }}</h1>
    <p>{{ subtitle() }}</p>
    <ng-content />
  </header>`,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input('');
}
@Component({
  selector: 'app-status-badge',
  template: `<span class="badge" [class.inactive]="status() === 'BAJA'">{{ status() }}</span>`,
})
export class StatusBadge {
  readonly status = input.required<string>();
}
@Component({
  selector: 'app-empty-state',
  template: `<div class="empty">
    <h2>{{ title() }}</h2>
    <p>{{ description() }}</p>
  </div>`,
})
export class EmptyState {
  readonly title = input('Sin resultados');
  readonly description = input('Prueba otros filtros.');
}
@Component({
  selector: 'app-loading-state',
  template: `<p role="status" aria-live="polite">Cargando datos…</p>`,
})
export class LoadingState {}
@Component({
  selector: 'app-error-state',
  template: `@if (message()) {
    <p class="error" role="alert">{{ message() }}</p>
  }`,
})
export class ErrorState {
  readonly message = input('');
}
@Component({
  selector: 'app-confirm-dialog',
  template: `<dialog #dialog aria-modal="true" aria-labelledby="confirm-title">
    <h2 id="confirm-title">{{ title() }}</h2>
    <p>{{ description() }}</p>
    <div class="actions">
      <button autofocus (click)="cancelled.emit()">Cancelar</button
      ><button class="danger" (click)="confirmed.emit()">Confirmar</button>
    </div>
  </dialog>`,
  host: { '(keydown.escape)': 'cancelled.emit()' },
})
export class ConfirmDialog {
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  constructor() {
    afterNextRender(() => this.dialog().nativeElement.showModal());
  }
  readonly title = input.required<string>();
  readonly description = input('');
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
}
