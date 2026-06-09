insert into public.usuarios (nombre, curp, area, activo) values
  ('Ana Lopez', 'LOAA900101MDFPRN01', 'Finanzas', true),
  ('Carlos Perez', 'PECC880202HDFRRL02', 'Operacion', true),
  ('Usuario Inactivo', 'INAC900303HDFCTV03', 'Archivo', false)
on conflict (curp) do update set
  nombre = excluded.nombre,
  area = excluded.area,
  activo = excluded.activo;

insert into public.partidos (grupo, equipo_local, equipo_visitante, fecha_hora, estatus) values
  ('A', 'Equipo A1', 'Equipo A2', '2026-06-11 19:00:00 America/Mexico_City', 'programado'),
  ('A', 'Equipo A3', 'Equipo A4', '2026-06-12 13:00:00 America/Mexico_City', 'programado'),
  ('B', 'Equipo B1', 'Equipo B2', '2026-06-12 16:00:00 America/Mexico_City', 'programado'),
  ('B', 'Equipo B3', 'Equipo B4', '2026-06-13 19:00:00 America/Mexico_City', 'programado');
