create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
create table public.filada (
 id uuid primary key default gen_random_uuid(), nombre text not null check(length(trim(nombre)) between 1 and 120), created_at timestamptz not null default now()
);
create table public.perfil (
 id uuid primary key references auth.users(id) on delete cascade, created_at timestamptz not null default now()
);
create table public.festero (
 id uuid primary key default gen_random_uuid(), filada_id uuid not null references public.filada(id),
 nombre text not null check(length(trim(nombre)) between 1 and 100), apellidos text not null check(length(trim(apellidos)) between 1 and 180),
 documento text check(documento is null or documento ~ '^[A-Z0-9]{8,12}$'), fecha_nacimiento date not null check(fecha_nacimiento >= date '1900-01-01' and fecha_nacimiento <= current_date),
 email text check(email is null or email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'), telefono text check(telefono is null or telefono ~ '^\+?[0-9 ()-]{6,25}$'), direccion text check(length(direccion)<=500),
 fecha_alta date not null default current_date, fecha_baja date, estado text not null default 'ACTIVO' check(estado in ('ACTIVO','BAJA')), categoria text not null default 'SOCIO' check(length(trim(categoria)) between 1 and 60),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(filada_id,id), unique(filada_id,documento), check(fecha_alta>=fecha_nacimiento), check((estado='ACTIVO' and fecha_baja is null) or (estado='BAJA' and fecha_baja>=fecha_alta))
);
create table public.usuario_filada (
 id uuid primary key default gen_random_uuid(), usuario_id uuid not null references public.perfil(id) on delete cascade, filada_id uuid not null references public.filada(id), festero_id uuid,
 unique(usuario_id,filada_id), unique(filada_id,festero_id), unique(filada_id,id), foreign key(filada_id,festero_id) references public.festero(filada_id,id)
);
create table public.rol (codigo text primary key check(codigo ~ '^[A-Z_]{3,40}$'), nombre text not null);
insert into public.rol values ('ADMINISTRADOR','Administrador'),('JUNTA','Junta'),('TESORERO','Tesorero'),('FESTERO','Festero');
create table public.usuario_rol (
 filada_id uuid not null, usuario_filada_id uuid not null, rol_codigo text not null references public.rol(codigo),
 primary key(usuario_filada_id,rol_codigo), foreign key(filada_id,usuario_filada_id) references public.usuario_filada(filada_id,id) on delete cascade
);
create table public.responsable_festero (
 id uuid primary key default gen_random_uuid(), filada_id uuid not null references public.filada(id), responsable_id uuid not null, dependiente_id uuid not null,
 tipo_relacion text not null check(tipo_relacion in ('PADRE','MADRE','TUTOR','RESPONSABLE','OTRO')), puede_gestionar boolean not null default false,
 fecha_desde date not null default current_date, fecha_hasta date,
 foreign key(filada_id,responsable_id) references public.festero(filada_id,id), foreign key(filada_id,dependiente_id) references public.festero(filada_id,id),
 check(responsable_id<>dependiente_id), check(fecha_hasta is null or fecha_hasta>=fecha_desde), unique(filada_id,responsable_id,dependiente_id,fecha_desde)
);
create table public.audit_log (
 id bigint generated always as identity primary key, filada_id uuid not null references public.filada(id), usuario uuid, accion text not null, entidad text not null, entity_id text not null, fecha timestamptz not null default now(), metadata jsonb not null default '{}'
);
create index on public.festero(filada_id,estado);
create index on public.festero(filada_id,apellidos,nombre);
create index on public.usuario_filada(festero_id);
create index on public.usuario_filada(filada_id);
create index on public.usuario_rol(filada_id);
create index on public.usuario_rol(rol_codigo);
create index on public.responsable_festero(filada_id,dependiente_id);
create index on public.responsable_festero(filada_id,responsable_id);
create index on public.audit_log(filada_id,fecha desc);
create function private.member(tenant uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.usuario_filada where usuario_id=auth.uid() and filada_id=tenant)
$$;
create function private.has_role(tenant uuid, roles text[]) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.usuario_filada u join public.usuario_rol r on r.usuario_filada_id=u.id and r.filada_id=u.filada_id where u.usuario_id=auth.uid() and u.filada_id=tenant and r.rol_codigo=any(roles))
$$;
create function private.can_read_festero(tenant uuid, target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.has_role(tenant,array['ADMINISTRADOR','JUNTA']) or (private.has_role(tenant,array['FESTERO']) and exists(
 select 1 from public.usuario_filada u where u.usuario_id=auth.uid() and u.filada_id=tenant and
 (u.festero_id=target or exists(select 1 from public.responsable_festero r where r.filada_id=tenant and r.responsable_id=u.festero_id and r.dependiente_id=target and r.puede_gestionar and r.fecha_desde<=current_date and (r.fecha_hasta is null or r.fecha_hasta>=current_date)))))
$$;
revoke all on all functions in schema private from public;
grant execute on function private.member(uuid), private.has_role(uuid,text[]), private.can_read_festero(uuid,uuid) to authenticated;
create function private.validate_festero() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='UPDATE' and (new.id<>old.id or new.filada_id<>old.filada_id) then raise exception 'Identidad inmutable'; end if;
 if exists(select 1 from public.responsable_festero r where r.responsable_id=new.id and r.filada_id=new.filada_id and new.fecha_nacimiento > (r.fecha_desde - interval '18 years')::date) then raise exception 'El responsable debe ser adulto'; end if;
 if TG_OP='INSERT' then new.created_at=now(); else new.created_at=old.created_at; end if;
 new.updated_at=now(); return new;
end $$;
create trigger validate_festero before insert or update on public.festero for each row execute function private.validate_festero();
create function private.validate_relation() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.festero where id=new.responsable_id and filada_id=new.filada_id and fecha_nacimiento <= (new.fecha_desde-interval '18 years')::date) then raise exception 'El responsable debe ser adulto'; end if;
 if TG_OP='UPDATE' and (new.id<>old.id or new.filada_id<>old.filada_id) then raise exception 'Identidad inmutable'; end if;
 return new;
end $$;
create trigger validate_relation before insert or update on public.responsable_festero for each row execute function private.validate_relation();
create function private.audit() returns trigger language plpgsql security definer set search_path='' as $$
declare row_data jsonb;
begin
 row_data=case when TG_OP='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 insert into public.audit_log(filada_id,usuario,accion,entidad,entity_id,metadata) values ((row_data->>'filada_id')::uuid,auth.uid(),TG_OP,TG_TABLE_NAME,coalesce(row_data->>'id',row_data->>'usuario_filada_id'),case when TG_TABLE_NAME='usuario_rol' then jsonb_build_object('rol',row_data->>'rol_codigo') else '{}'::jsonb end);
 return null;
end $$;
create trigger audit_festero after insert or update on public.festero for each row execute function private.audit();
create trigger audit_relation after insert or update or delete on public.responsable_festero for each row execute function private.audit();
create trigger audit_roles after insert or update or delete on public.usuario_rol for each row execute function private.audit();
create trigger audit_membership after insert or update or delete on public.usuario_filada for each row execute function private.audit();
create function private.new_user() returns trigger language plpgsql security definer set search_path='' as $$ begin insert into public.perfil(id) values(new.id); return new; end $$;
create trigger new_auth_user after insert on auth.users for each row execute function private.new_user();
insert into public.perfil(id) select id from auth.users on conflict do nothing;
alter table public.filada enable row level security;
alter table public.perfil enable row level security;
alter table public.festero enable row level security;
alter table public.usuario_filada enable row level security;
alter table public.rol enable row level security;
alter table public.usuario_rol enable row level security;
alter table public.responsable_festero enable row level security;
alter table public.audit_log enable row level security;
create policy read_filada on public.filada for select to authenticated using(private.member(id));
create policy read_profile on public.perfil for select to authenticated using(id=auth.uid());
create policy read_membership on public.usuario_filada for select to authenticated using(usuario_id=auth.uid() or private.has_role(filada_id,array['ADMINISTRADOR']));
create policy admin_membership on public.usuario_filada for all to authenticated using(private.has_role(filada_id,array['ADMINISTRADOR'])) with check(private.has_role(filada_id,array['ADMINISTRADOR']));
create policy read_roles on public.rol for select to authenticated using(true);
create policy read_user_roles on public.usuario_rol for select to authenticated using(exists(select 1 from public.usuario_filada u where u.id=usuario_filada_id and u.usuario_id=auth.uid()) or private.has_role(filada_id,array['ADMINISTRADOR']));
create policy admin_roles on public.usuario_rol for all to authenticated using(private.has_role(filada_id,array['ADMINISTRADOR'])) with check(private.has_role(filada_id,array['ADMINISTRADOR']));
create policy read_festero on public.festero for select to authenticated using(private.can_read_festero(filada_id,id));
create policy insert_festero on public.festero for insert to authenticated with check(private.has_role(filada_id,array['ADMINISTRADOR','JUNTA']));
create policy update_festero on public.festero for update to authenticated using(private.has_role(filada_id,array['ADMINISTRADOR','JUNTA'])) with check(private.has_role(filada_id,array['ADMINISTRADOR','JUNTA']));
create policy read_relation on public.responsable_festero for select to authenticated using(private.has_role(filada_id,array['ADMINISTRADOR','JUNTA']) or (private.has_role(filada_id,array['FESTERO']) and puede_gestionar and fecha_desde<=current_date and (fecha_hasta is null or fecha_hasta>=current_date) and exists(select 1 from public.usuario_filada u where u.usuario_id=auth.uid() and u.filada_id=responsable_festero.filada_id and u.festero_id=responsable_id)));
create policy manage_relation on public.responsable_festero for all to authenticated using(private.has_role(filada_id,array['ADMINISTRADOR','JUNTA'])) with check(private.has_role(filada_id,array['ADMINISTRADOR','JUNTA']));
create policy read_audit on public.audit_log for select to authenticated using(private.has_role(filada_id,array['ADMINISTRADOR']));
revoke all on all tables in schema public from anon, authenticated;
grant select on public.filada,public.perfil,public.rol,public.audit_log to authenticated;
grant select,insert,update on public.festero to authenticated;
grant select,insert,update,delete on public.usuario_filada,public.usuario_rol,public.responsable_festero to authenticated;
revoke execute on all functions in schema private from public;

-- Prevent accidental loss of the last administrator; operators can bootstrap with no JWT.
create function private.protect_last_admin() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.rol_codigo='ADMINISTRADOR' and auth.uid() is not null then
  perform 1 from public.filada where id=old.filada_id for update;
  if (TG_OP='DELETE' or new.rol_codigo<>'ADMINISTRADOR' or new.usuario_filada_id<>old.usuario_filada_id or new.filada_id<>old.filada_id)
    and (select count(*) from public.usuario_rol where filada_id=old.filada_id and rol_codigo='ADMINISTRADOR')<=1 then
   raise exception 'Debe conservarse al menos un administrador';
  end if;
 end if;
 if TG_OP='DELETE' then return old; end if;
 return new;
end $$;
create trigger protect_last_admin before delete or update on public.usuario_rol for each row execute function private.protect_last_admin();
revoke all on function private.protect_last_admin() from public;
