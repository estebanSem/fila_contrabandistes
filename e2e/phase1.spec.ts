import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const url = process.env['API_URL'] ?? '';
const key = process.env['ANON_KEY'] ?? '';
const serviceKey = process.env['SERVICE_ROLE_KEY'] ?? '';
let operator: SupabaseClient;
const tenant = randomUUID(),
  otherTenant = randomUUID();
const adult = randomUUID(),
  child = randomUUID(),
  outsider = randomUUID();
const suffix = randomUUID();
const adminEmail = `admin-${suffix}@example.org`,
  memberEmail = `festero-${suffix}@example.org`;
const password = randomUUID() + 'aA!7';
const otherEmail = `other-${suffix}@example.org`;
const userIds: string[] = [];
async function checked(result: PromiseLike<{ error: unknown }>) {
  const { error } = await result;
  if (error) throw error;
}
test.beforeAll(async () => {
  if (!url || !key || !serviceKey)
    throw new Error('Inicia Supabase local y aporta API_URL, ANON_KEY y SERVICE_ROLE_KEY.');
  if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname))
    throw new Error('Estas pruebas solo se ejecutan en Supabase local.');
  operator = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  writeFileSync('public/config.json', JSON.stringify({ supabaseUrl: url, supabaseAnonKey: key }));
  await checked(
    operator.from('filada').insert([
      { id: tenant, nombre: 'Filà prueba A' },
      { id: otherTenant, nombre: 'Filà prueba B' },
    ]),
  );
  await checked(
    operator.from('festero').insert([
      {
        id: adult,
        filada_id: tenant,
        nombre: 'Responsable',
        apellidos: 'Prueba',
        fecha_nacimiento: '1980-01-01',
      },
      {
        id: child,
        filada_id: tenant,
        nombre: 'Menor',
        apellidos: 'Prueba',
        fecha_nacimiento: '2016-01-01',
      },
      {
        id: outsider,
        filada_id: otherTenant,
        nombre: 'SECRETO_B',
        apellidos: 'Otra filà',
        fecha_nacimiento: '1980-01-01',
      },
    ]),
  );
  for (const [email, role, festero, filada] of [
    [adminEmail, 'ADMINISTRADOR', null, tenant],
    [memberEmail, 'FESTERO', adult, tenant],
    [otherEmail, 'ADMINISTRADOR', outsider, otherTenant],
  ] as const) {
    const { data, error } = await operator.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    userIds.push(data.user.id);
    const membership = randomUUID();
    await checked(
      operator.from('usuario_filada').insert({
        id: membership,
        usuario_id: data.user.id,
        filada_id: filada,
        festero_id: festero,
      }),
    );
    await checked(
      operator
        .from('usuario_rol')
        .insert({ filada_id: filada, usuario_filada_id: membership, rol_codigo: role }),
    );
  }
  await checked(
    operator.from('responsable_festero').insert({
      filada_id: tenant,
      responsable_id: adult,
      dependiente_id: child,
      tipo_relacion: 'TUTOR',
      puede_gestionar: true,
    }),
  );
});
test.afterAll(async () => {
  if (!operator) return;
  for (const table of [
    'responsable_festero',
    'usuario_rol',
    'usuario_filada',
    'festero',
    'audit_log',
    'filada',
  ])
    await checked(
      operator
        .from(table)
        .delete()
        .in(table === 'filada' ? 'id' : 'filada_id', [tenant, otherTenant]),
    );
  for (const id of userIds) await operator.auth.admin.deleteUser(id);
});
test('login, alta, edición, baja lógica, familia y logout en móvil', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/auth');
  await page.getByLabel('Correo electrónico').fill(adminEmail);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tu filà, más cerca' })).toBeVisible();
  await page.getByRole('navigation').getByRole('link', { name: 'Festeros', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Prueba, Responsable' })).toBeVisible();
  await expect(page.getByText('SECRETO_B')).toHaveCount(0);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({ path: '/tmp/fila-mobile.png', fullPage: true });
  await page.getByRole('combobox', { name: /^Edad/ }).selectOption('minor');
  await expect(page.getByRole('link', { name: 'Prueba, Menor' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Prueba, Responsable' })).toHaveCount(0);
  await page.getByRole('combobox', { name: /^Edad/ }).selectOption('');
  await page.getByLabel('Buscar por nombre').fill('Responsable');
  await expect(page.getByRole('link', { name: 'Prueba, Responsable' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Prueba, Menor' })).toHaveCount(0);
  await page.getByLabel('Buscar por nombre').fill('');
  await expect(page.getByRole('link', { name: 'Prueba, Menor' })).toBeVisible();

  await page.getByRole('link', { name: 'Añadir festero' }).click();
  await page.getByLabel('Nombre *', { exact: true }).fill('Nueva');
  await page.getByLabel('Apellidos *').fill('Integración');
  await page.getByLabel('Fecha de nacimiento *').fill('1995-01-01');
  await page.getByRole('button', { name: 'Guardar ficha' }).click();
  await page.getByRole('link', { name: 'Integración, Nueva' }).click();
  await page.getByLabel('Nombre *', { exact: true }).fill('Editada');
  await page.getByRole('button', { name: 'Guardar ficha' }).click();
  const row = page.getByRole('row').filter({ hasText: 'Integración, Editada' });
  await row.getByRole('button', { name: 'Dar de baja' }).click();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(row.getByText('BAJA', { exact: true })).toBeVisible();
  await page.getByRole('navigation').getByRole('link', { name: 'Familias', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'TUTOR', exact: true })).toBeVisible();
  await page
    .locator('app-festero-selector')
    .filter({ hasText: 'Responsable adulto' })
    .locator('select')
    .selectOption({ label: 'Integración, Editada' });
  await page
    .locator('app-festero-selector')
    .filter({ hasText: 'Dependiente' })
    .locator('select')
    .selectOption(child);
  await page.getByLabel('Autorizar acceso al dependiente').check();
  await page.getByRole('button', { name: 'Guardar relación', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'RESPONSABLE', exact: true })).toBeVisible();

  await page
    .getByRole('row')
    .filter({ has: page.getByRole('cell', { name: 'TUTOR', exact: true }) })
    .getByRole('button', { name: 'Finalizar', exact: true })
    .click();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByText('Sin autorización', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Bienvenido a tu filà' })).toBeVisible();
});
test('festero ve su ficha; relación revocada oculta dependiente y rutas administrativas', async ({
  page,
}) => {
  await checked(
    operator.from('responsable_festero').update({ puede_gestionar: false }).eq('filada_id', tenant),
  );
  await checked(
    operator
      .from('responsable_festero')
      .update({ puede_gestionar: true, fecha_hasta: null })
      .eq('filada_id', tenant)
      .eq('responsable_id', adult),
  );
  await page.goto('/auth');
  await page.getByLabel('Correo electrónico').fill(memberEmail);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tu filà, más cerca' })).toBeVisible();
  await page.getByRole('link', { name: 'Mis datos', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Prueba, Responsable' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Prueba, Menor' })).toBeVisible();
  await checked(
    operator
      .from('responsable_festero')
      .update({ puede_gestionar: false })
      .eq('filada_id', tenant)
      .eq('responsable_id', adult),
  );
  await page.reload();
  await expect(page.getByRole('link', { name: 'Prueba, Responsable' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Prueba, Menor' })).toHaveCount(0);
  await expect(page.getByText('SECRETO_B')).toHaveCount(0);
  await page.goto('/administracion');
  await expect(page.getByRole('heading', { name: 'Tu filà, más cerca' })).toBeVisible();
  await page.goto(`/festeros/${outsider}`);
  await expect(page.getByRole('alert')).toContainText('Ficha no disponible');
});
test('recuperación ofrece respuesta neutra', async ({ page }) => {
  await page.goto('/auth');
  await page.getByRole('button', { name: 'He olvidado mi contraseña' }).click();
  await page.getByLabel('Correo electrónico').fill(memberEmail);
  await page.getByRole('button', { name: 'Enviar enlace' }).click();
  await expect(page.getByRole('status')).toContainText('Si la cuenta existe');
});

test('API autenticada rechaza tenant falsificado y no revela otra filà', async () => {
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email: adminEmail, password });
  if (error) throw error;
  const read = await client.from('festero').select('*').eq('filada_id', otherTenant);
  expect(read.error).toBeNull();
  expect(read.data).toEqual([]);
  const insert = await client.from('festero').insert({
    filada_id: otherTenant,
    nombre: 'Ataque',
    apellidos: 'No permitido',
    fecha_nacimiento: '1980-01-01',
  });
  expect(insert.error?.code).toBe('42501');
  await client.auth.signOut();
  const loginB = await client.auth.signInWithPassword({ email: otherEmail, password });
  if (loginB.error) throw loginB.error;
  const readA = await client.from('festero').select('*').eq('filada_id', tenant);
  expect(readA.error).toBeNull();
  expect(readA.data).toEqual([]);
  await client.auth.signOut();
});

test('enlace de recuperación permite establecer contraseña y volver a entrar', async ({ page }) => {
  const mailUrl = process.env['INBUCKET_URL'] ?? 'http://127.0.0.1:54324';
  if (!['127.0.0.1', 'localhost'].includes(new URL(mailUrl).hostname))
    throw new Error('Mailpit debe ser local');
  interface Message {
    ID: string;
    To: { Address: string }[];
  }
  const inbox = async (): Promise<Message[]> =>
    (await (await fetch(`${mailUrl}/api/v1/messages`)).json()).messages;
  const previous = new Set((await inbox()).map((m) => m.ID));
  await page.goto('/auth');
  await page.getByRole('button', { name: 'He olvidado mi contraseña' }).click();
  await page.getByLabel('Correo electrónico').fill(memberEmail);
  await page.getByRole('button', { name: 'Enviar enlace' }).click();
  await expect(page.getByRole('status')).toContainText('Si la cuenta existe');
  let message: Message | undefined;
  await expect
    .poll(async () => {
      message = (await inbox()).find(
        (m) => !previous.has(m.ID) && m.To.some((to) => to.Address === memberEmail),
      );
      return !!message;
    })
    .toBe(true);
  const detail: { HTML: string } = await (
    await fetch(`${mailUrl}/api/v1/message/${message!.ID}`)
  ).json();
  const links = [...detail.HTML.matchAll(/href="([^"]+)"/g)].map((m) =>
    m[1].replaceAll('&amp;', '&'),
  );
  const link = links.find((link) => {
    const u = new URL(link);
    return ['localhost', '127.0.0.1'].includes(u.hostname) && u.pathname === '/auth/v1/verify';
  });
  if (!link) throw new Error('El correo no contiene un enlace local de recuperación');
  try {
    await page.goto(link);
  } catch {
    throw new Error('No se pudo abrir el enlace de recuperación');
  }
  await expect(page.getByRole('heading', { name: 'Nueva contraseña' })).toBeVisible();
  const nextPassword = randomUUID() + 'aA!8';
  await page.getByLabel('Contraseña', { exact: true }).fill(nextPassword);
  await page.getByRole('button', { name: 'Guardar contraseña' }).click();
  await expect(page.getByRole('heading', { name: 'Tu filà, más cerca' })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await page.getByLabel('Correo electrónico').fill(memberEmail);
  await page.getByLabel('Contraseña', { exact: true }).fill(nextPassword);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tu filà, más cerca' })).toBeVisible();
});

test('administración asigna y revoca roles y muestra auditoría', async ({ page }) => {
  await page.goto('/auth');
  await page.getByLabel('Correo electrónico').fill(adminEmail);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tu filà, más cerca' })).toBeVisible();
  await page.getByRole('link', { name: 'Administración', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Administración', exact: true })).toBeVisible();
  await page.screenshot({ path: '/tmp/fila-admin.png', fullPage: true });
  await page.getByRole('combobox', { name: /^Usuario/ }).selectOption({ label: userIds[1] });
  await page.getByRole('combobox', { name: /^Rol/ }).selectOption('JUNTA');
  await page.getByRole('button', { name: 'Asignar rol', exact: true }).click();
  const assigned = page
    .getByRole('listitem')
    .filter({ hasText: userIds[1] })
    .filter({ hasText: 'JUNTA' });
  await expect(assigned).toBeVisible();
  await assigned.getByRole('button', { name: 'Revocar' }).click();
  await expect(assigned).toHaveCount(0);
  await expect(page.getByRole('cell', { name: 'usuario_rol', exact: true }).first()).toBeVisible();
  const own = page
    .getByRole('listitem')
    .filter({ hasText: userIds[0] })
    .filter({ hasText: 'ADMINISTRADOR' });
  await own.getByRole('button', { name: 'Revocar' }).click();
  await expect(page.getByRole('alert')).toContainText('Operación rechazada');
  await expect(own).toBeVisible();
});
