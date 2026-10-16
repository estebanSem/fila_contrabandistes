import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  Router,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
} from '@angular/router';
import { describe, it, expect } from 'vitest';
import { AuthService } from './auth.service';
import { authGuard, adminGuard, managerGuard } from './guards';
describe('guards de navegación', () => {
  it('envía a login a quien no tiene sesión', () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: { session: () => null } }],
    });
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
    expect(TestBed.inject(Router).serializeUrl(result as never)).toBe('/auth');
  });
  it('bloquea gestión y administración sin roles', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { canManage: () => false, isAdmin: () => false } },
      ],
    });
    for (const guard of [adminGuard, managerGuard])
      expect(
        TestBed.runInInjectionContext(() =>
          guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
        ),
      ).not.toBe(true);
  });
});
