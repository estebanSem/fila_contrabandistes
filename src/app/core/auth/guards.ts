import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
export const authGuard: CanActivateFn = () =>
  inject(AuthService).session() ? true : inject(Router).createUrlTree(['/auth']);
export const managerGuard: CanActivateFn = () =>
  inject(AuthService).canManage() ? true : inject(Router).createUrlTree(['/']);
export const adminGuard: CanActivateFn = () =>
  inject(AuthService).isAdmin() ? true : inject(Router).createUrlTree(['/']);
