import { describe, it, expect } from 'vitest';
import { adultBirthCutoff, canManage, isAdult } from './domain';
describe('permisos por rol', () => {
  it('administrador y junta gestionan el padrón', () => {
    expect(canManage(['ADMINISTRADOR'])).toBe(true);
    expect(canManage(['JUNTA'])).toBe(true);
  });
  it('tesorero, festero y roles nuevos no reciben permisos implícitos', () => {
    for (const r of [[], ['TESORERO'], ['FESTERO'], ['NUEVO']]) expect(canManage(r)).toBe(false);
  });
});
describe('mayoría de edad derivada', () => {
  it('respeta el día del cumpleaños', () => {
    expect(isAdult('2008-10-16', new Date(2026, 9, 15))).toBe(false);
    expect(isAdult('2008-10-16', new Date(2026, 9, 16))).toBe(true);
  });
});

it('el filtro de adultos no adelanta cumpleaños al cruzar un 29 de febrero', () => {
  expect(adultBirthCutoff(new Date(2024, 1, 29))).toBe('2006-02-28');
  expect(adultBirthCutoff(new Date(2026, 9, 16))).toBe('2008-10-16');
});
