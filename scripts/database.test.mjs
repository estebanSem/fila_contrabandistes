import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const A = id(1),
  B = id(2),
  admin = id(10),
  member = id(11),
  outsider = id(12),
  treasurer = id(13),
  board = id(14);
const adult = id(20),
  child = id(21),
  other = id(22),
  foreign = id(23),
  minor = id(24);
async function as(user, sql, params = []) {
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub','${user}',false)`,
  );
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role');
  }
}
before(async () => {
  await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
  await db.exec(readFileSync('supabase/migrations/202610160001_foundation.sql', 'utf8'));
  await db.query('insert into auth.users values ($1),($2),($3),($4),($5)', [
    admin,
    member,
    outsider,
    treasurer,
    board,
  ]);
  await db.query("insert into filada(id,nombre) values ($1,'A'),($2,'B')", [A, B]);
  for (const [festero, tenant, name, birth] of [
    [adult, A, 'Adulto', '1980-01-01'],
    [child, A, 'Menor', '2016-01-01'],
    [other, A, 'Ajeno', '1990-01-01'],
    [foreign, B, 'Secreto B', '1980-01-01'],
    [minor, A, 'Otro menor', '2015-01-01'],
  ]) {
    await db.query(
      "insert into festero(id,filada_id,nombre,apellidos,fecha_nacimiento) values($1,$2,$3,'Apellido',$4)",
      [festero, tenant, name, birth],
    );
  }
  for (const [u, t, f, r] of [
    [admin, A, null, 'ADMINISTRADOR'],
    [member, A, adult, 'FESTERO'],
    [outsider, B, foreign, 'ADMINISTRADOR'],
    [treasurer, A, null, 'TESORERO'],
    [board, A, null, 'JUNTA'],
  ]) {
    const { rows } = await db.query(
      'insert into usuario_filada(usuario_id,filada_id,festero_id) values($1,$2,$3) returning id',
      [u, t, f],
    );
    await db.query('insert into usuario_rol values($1,$2,$3)', [t, rows[0].id, r]);
  }
  await db.query(
    "insert into responsable_festero(filada_id,responsable_id,dependiente_id,tipo_relacion,puede_gestionar) values($1,$2,$3,'PADRE',true)",
    [A, adult, child],
  );
});
after(() => db.close());
test('administrador A solo lee A, incluso sin filtro del cliente', async () => {
  const { rows } = await as(admin, 'select * from festero');
  assert.equal(rows.length, 4);
  assert.ok(rows.every((r) => r.filada_id === A));
  const other = await as(admin, 'select * from festero where filada_id=$1', [B]);
  assert.equal(other.rows.length, 0);
});
test('A no puede insertar, mover, actualizar ni borrar datos de B', async () => {
  await assert.rejects(
    as(
      admin,
      "insert into festero(filada_id,nombre,apellidos,fecha_nacimiento) values($1,'Ataque','X','1990-01-01')",
      [B],
    ),
    /row-level security/,
  );
  assert.equal(
    (await as(admin, "update festero set nombre='Ataque' where id=$1 returning id", [foreign])).rows
      .length,
    0,
  );
  await assert.rejects(as(admin, 'update festero set filada_id=$1 where id=$2', [B, other]));
  await assert.rejects(as(admin, 'delete from festero where id=$1', [adult]), /permission denied/);
});
test('festero ve su ficha y dependiente autorizado, no vecinos ni B', async () => {
  const { rows } = await as(member, 'select id from festero order by id');
  assert.deepEqual(
    rows.map((r) => r.id),
    [adult, child],
  );
  assert.equal(
    (await as(member, "update festero set nombre='Hack' where id=$1 returning id", [adult])).rows
      .length,
    0,
  );
  await assert.rejects(
    as(
      member,
      "insert into festero(filada_id,nombre,apellidos,fecha_nacimiento) values($1,'Hack','X','2000-01-01')",
      [A],
    ),
    /row-level security/,
  );
});
test('revocación y vigencia eliminan acceso a dependientes', async () => {
  await db.query('update responsable_festero set puede_gestionar=false where dependiente_id=$1', [
    child,
  ]);
  assert.equal((await as(member, 'select * from festero where id=$1', [child])).rows.length, 0);
  await db.query(
    'update responsable_festero set puede_gestionar=true,fecha_hasta=current_date-1,fecha_desde=current_date-2 where dependiente_id=$1',
    [child],
  );
  assert.equal((await as(member, 'select * from festero where id=$1', [child])).rows.length, 0);
  await db.query(
    'update responsable_festero set fecha_hasta=null,fecha_desde=current_date where dependiente_id=$1',
    [child],
  );
});
test('relaciones rechazan cruces, menores responsables y autorreferencia', async () => {
  const insert =
    "insert into responsable_festero(filada_id,responsable_id,dependiente_id,tipo_relacion) values($1,$2,$3,'TUTOR')";
  await assert.rejects(as(admin, insert, [A, adult, foreign]), /foreign key/);
  await assert.rejects(as(admin, insert, [A, minor, other]), /adulto/);
  await assert.rejects(as(admin, insert, [A, adult, adult]), /check constraint/);
  await assert.rejects(as(member, insert, [A, adult, other]), /row-level security/);
});
test('tesorero no accede al padrón; junta gestiona, sin elevar permisos', async () => {
  assert.equal((await as(treasurer, 'select * from festero')).rows.length, 0);
  assert.equal((await as(board, 'select * from festero')).rows.length, 4);
  await assert.rejects(
    as(
      board,
      "insert into usuario_rol select filada_id,id,'ADMINISTRADOR' from usuario_filada where usuario_id=$1",
      [board],
    ),
    /row-level security/,
  );
});
test('roles y pertenencias no permiten escalada ni asociación con otra filà', async () => {
  const membership = (await db.query('select id from usuario_filada where usuario_id=$1', [member]))
    .rows[0].id;
  await assert.rejects(
    as(member, "insert into usuario_rol values($1,$2,'ADMINISTRADOR')", [A, membership]),
    /row-level security/,
  );
  await assert.rejects(
    as(admin, "insert into usuario_rol values($1,$2,'JUNTA')", [B, membership]),
    /row-level security|foreign key/,
  );
  await assert.rejects(
    as(admin, 'update usuario_filada set festero_id=$1 where id=$2', [foreign, membership]),
    /foreign key/,
  );
});
test('baja lógica conserva ficha; constraints validan datos', async () => {
  await as(board, "update festero set estado='BAJA',fecha_baja=current_date where id=$1", [other]);
  assert.equal(
    (await as(admin, 'select estado from festero where id=$1', [other])).rows[0].estado,
    'BAJA',
  );
  await assert.rejects(
    as(admin, 'update festero set fecha_nacimiento=current_date+1 where id=$1', [other]),
    /check constraint/,
  );
  await assert.rejects(
    as(admin, "update festero set email='invalido' where id=$1", [other]),
    /check constraint/,
  );
});
test('auditoría automática restringida y sin datos personales completos', async () => {
  const { rows } = await as(admin, 'select * from audit_log');
  assert.ok(rows.length > 0);
  assert.ok(rows.every((r) => r.filada_id === A));
  assert.ok(rows.some((r) => r.entidad === 'usuario_rol'));
  assert.ok(rows.some((r) => r.entidad === 'responsable_festero'));
  assert.ok(rows.every((r) => Object.keys(r.metadata).every((k) => k === 'rol')));
  assert.equal((await as(member, 'select * from audit_log')).rows.length, 0);
  await assert.rejects(
    as(
      admin,
      "insert into audit_log(filada_id,accion,entidad,entity_id) values($1,'Falso','X','X')",
      [A],
    ),
    /permission denied/,
  );
});
test('anónimo no tiene acceso al padrón', async () => {
  await db.exec('set role anon');
  try {
    await assert.rejects(db.query('select * from festero'), /permission denied/);
  } finally {
    await db.exec('reset role');
  }
});
test('no se puede revocar el último administrador de una filà', async () => {
  const membership = (await db.query('select id from usuario_filada where usuario_id=$1', [admin]))
    .rows[0].id;
  await assert.rejects(
    as(admin, "delete from usuario_rol where usuario_filada_id=$1 and rol_codigo='ADMINISTRADOR'", [
      membership,
    ]),
    /al menos un administrador/,
  );
});
test('todos los metadatos sensibles mantienen aislamiento por filà', async () => {
  for (const table of [
    'filada',
    'usuario_filada',
    'usuario_rol',
    'responsable_festero',
    'audit_log',
  ]) {
    const { rows } = await as(admin, `select * from ${table}`);
    assert.ok(
      rows.every((r) => (r.filada_id ?? r.id) === A),
      table,
    );
  }
  const { rows } = await as(member, 'select * from perfil');
  assert.deepEqual(
    rows.map((r) => r.id),
    [member],
  );
});
test('una pertenencia sin rol FESTERO no obtiene acceso personal implícito', async () => {
  const membership = (await db.query('select id from usuario_filada where usuario_id=$1', [member]))
    .rows[0].id;
  await db.query("delete from usuario_rol where usuario_filada_id=$1 and rol_codigo='FESTERO'", [
    membership,
  ]);
  assert.equal((await as(member, 'select * from festero')).rows.length, 0);
  assert.equal((await as(member, 'select * from responsable_festero')).rows.length, 0);
  await db.query("insert into usuario_rol values($1,$2,'FESTERO')", [A, membership]);
});
test('una autorización futura no concede acceso anticipado', async () => {
  await db.query(
    'update responsable_festero set fecha_desde=current_date+1 where dependiente_id=$1',
    [child],
  );
  assert.equal((await as(member, 'select * from festero where id=$1', [child])).rows.length, 0);
  await db.query(
    'update responsable_festero set fecha_desde=current_date where dependiente_id=$1',
    [child],
  );
});
test('no permite convertir en menor a un responsable ya relacionado', async () => {
  await assert.rejects(
    as(admin, 'update festero set fecha_nacimiento=$1 where id=$2', ['2015-01-01', adult]),
    /adulto/,
  );
});
test('el administrador de B tampoco puede leer ni escribir en A', async () => {
  assert.deepEqual(
    (await as(outsider, 'select id from festero')).rows.map((r) => r.id),
    [foreign],
  );
  assert.equal(
    (await as(outsider, 'select * from usuario_filada where filada_id=$1', [A])).rows.length,
    0,
  );
  await assert.rejects(
    as(
      outsider,
      "insert into responsable_festero(filada_id,responsable_id,dependiente_id,tipo_relacion) values($1,$2,$3,'TUTOR')",
      [A, adult, child],
    ),
    /row-level security/,
  );
});
