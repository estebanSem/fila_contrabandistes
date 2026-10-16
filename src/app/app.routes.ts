import { Routes } from '@angular/router';
import { authGuard, adminGuard, managerGuard } from './core/auth/guards';
export const routes: Routes = [
  {
    path: 'auth',
    loadComponent: () => import('./features/auth/auth.page').then((m) => m.AuthPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'festeros',
        loadComponent: () =>
          import('./features/festeros/festeros.page').then((m) => m.FesterosPage),
      },
      {
        path: 'festeros/nuevo',
        canActivate: [managerGuard],
        loadComponent: () =>
          import('./features/festeros/festero-form.page').then((m) => m.FesteroFormPage),
      },
      {
        path: 'festeros/:id',
        loadComponent: () =>
          import('./features/festeros/festero-form.page').then((m) => m.FesteroFormPage),
      },
      {
        path: 'familias',
        loadComponent: () =>
          import('./features/familias/familias.page').then((m) => m.FamiliasPage),
      },
      {
        path: 'administracion',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/administracion/admin.page').then((m) => m.AdminPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
