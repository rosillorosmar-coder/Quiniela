create extension if not exists pgcrypto;

create table if not exists public.usuarios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  curp text not null unique,
  area text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.partidos (
  id uuid primary key default gen_random_uuid(),
  grupo text not null,
  equipo_local text not null,
  equipo_visitante text not null,
  fecha_hora timestamptz not null,
  sede text,
  goles_local_real integer check (goles_local_real is null or goles_local_real >= 0),
  goles_visitante_real integer check (goles_visitante_real is null or goles_visitante_real >= 0),
  estatus text not null default 'programado' check (estatus in ('programado', 'en_juego', 'finalizado')),
  created_at timestamptz not null default now()
);

alter table public.partidos add column if not exists sede text;

create table if not exists public.predicciones (
  id uuid primary key default gen_random_uuid(),
  id_usuario uuid not null references public.usuarios(id) on delete cascade,
  id_partido uuid not null references public.partidos(id) on delete cascade,
  goles_local_pred integer not null check (goles_local_pred >= 0 and goles_local_pred <= 30),
  goles_visitante_pred integer not null check (goles_visitante_pred >= 0 and goles_visitante_pred <= 30),
  puntos integer check (puntos in (0, 3, 6)),
  fecha_registro timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now(),
  constraint predicciones_usuario_partido_unique unique (id_usuario, id_partido)
);

create index if not exists partidos_fecha_grupo_idx on public.partidos (fecha_hora, grupo);
create index if not exists predicciones_usuario_idx on public.predicciones (id_usuario);
create index if not exists predicciones_partido_idx on public.predicciones (id_partido);

alter table public.usuarios enable row level security;
alter table public.partidos enable row level security;
alter table public.predicciones enable row level security;

drop policy if exists "No direct public usuarios access" on public.usuarios;
drop policy if exists "No direct public partidos access" on public.partidos;
drop policy if exists "No direct public predicciones access" on public.predicciones;

create or replace function public.fecha_cierre_predicciones()
returns timestamptz
language sql
stable
as $$
  select '2026-06-11 13:00:00 America/Mexico_City'::timestamptz;
$$;

create or replace function public.tipo_resultado(goles_local integer, goles_visitante integer)
returns text
language sql
immutable
as $$
  select case
    when goles_local > goles_visitante then 'local'
    when goles_local < goles_visitante then 'visitante'
    else 'empate'
  end;
$$;

create or replace function public.calcular_puntos(
  goles_local_pred integer,
  goles_visitante_pred integer,
  goles_local_real integer,
  goles_visitante_real integer
)
returns integer
language sql
immutable
as $$
  select case
    when goles_local_real is null or goles_visitante_real is null then null
    when goles_local_pred = goles_local_real and goles_visitante_pred = goles_visitante_real then 6
    when public.tipo_resultado(goles_local_pred, goles_visitante_pred)
      = public.tipo_resultado(goles_local_real, goles_visitante_real) then 3
    else 0
  end;
$$;

create or replace function public.validar_prediccion()
returns trigger
language plpgsql
as $$
declare
  usuario_activo boolean;
  cambio_captura boolean;
begin
  if tg_op = 'INSERT' then
    cambio_captura := true;
  else
    cambio_captura := old.id_usuario is distinct from new.id_usuario
      or old.id_partido is distinct from new.id_partido
      or old.goles_local_pred is distinct from new.goles_local_pred
      or old.goles_visitante_pred is distinct from new.goles_visitante_pred;
  end if;

  if cambio_captura and now() > public.fecha_cierre_predicciones() then
    raise exception 'La captura de predicciones cerro el 2026-06-11 13:00:00 America/Mexico_City.';
  end if;

  select activo into usuario_activo
  from public.usuarios
  where id = new.id_usuario;

  if usuario_activo is distinct from true then
    raise exception 'Solo usuarios activos pueden participar.';
  end if;

  if cambio_captura then
    new.puntos := null;
  end if;

  new.fecha_actualizacion := now();
  return new;
end;
$$;

drop trigger if exists predicciones_validar_trg on public.predicciones;
create trigger predicciones_validar_trg
before insert or update on public.predicciones
for each row execute function public.validar_prediccion();

create or replace function public.recalcular_puntos_partido(p_id_partido uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  partido record;
begin
  select goles_local_real, goles_visitante_real
  into partido
  from public.partidos
  where id = p_id_partido;

  if not found then
    raise exception 'Partido no encontrado.';
  end if;

  update public.predicciones p
  set puntos = public.calcular_puntos(
      p.goles_local_pred,
      p.goles_visitante_pred,
      partido.goles_local_real,
      partido.goles_visitante_real
    ),
    fecha_actualizacion = now()
  where p.id_partido = p_id_partido;
end;
$$;

create or replace function public.recalcular_puntos_partido_trigger()
returns trigger
language plpgsql
as $$
begin
  if new.goles_local_real is distinct from old.goles_local_real
    or new.goles_visitante_real is distinct from old.goles_visitante_real then
    perform public.recalcular_puntos_partido(new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists partidos_recalcular_puntos_trg on public.partidos;
create trigger partidos_recalcular_puntos_trg
after update of goles_local_real, goles_visitante_real on public.partidos
for each row execute function public.recalcular_puntos_partido_trigger();

create or replace view public.ranking as
select
  u.id as id_usuario,
  u.nombre,
  u.area,
  count(p.id)::integer as predicciones_capturadas,
  coalesce(sum(p.puntos), 0)::integer as puntos_totales,
  count(*) filter (where p.puntos = 6)::integer as marcadores_exactos,
  count(*) filter (where p.puntos = 3)::integer as resultados_acertados,
  count(*) filter (where p.puntos = 0)::integer as partidos_sin_puntos
from public.usuarios u
join public.predicciones p on p.id_usuario = u.id
where u.activo = true
group by u.id, u.nombre, u.area
order by puntos_totales desc, marcadores_exactos desc, u.nombre asc;
