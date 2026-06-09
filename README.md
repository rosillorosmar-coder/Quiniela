# Quiniela Mundial 2026

App web local para capturar predicciones de fase de grupos del Mundial 2026.

## Abrir en modo local

Ejecuta:

```bash
npm start
```

Abre:

```text
http://localhost:3000
```

Datos locales:

- Participante de prueba: `LOAA900101MDFPRN01`
- Admin: `admin2026`
- Base local: `data/db.json`

## Reglas implementadas

- Identificacion por CURP contra usuarios precargados y activos.
- Una prediccion por usuario y partido mediante constraint unico.
- Captura y edicion bloqueadas despues de `2026-06-11 13:00:00 America/Mexico_City`.
- Panel administrador protegido por clave local.
- Recalculo automatico al guardar resultados reales.
- Ranking ordenado por puntos totales y marcadores exactos.

## Despliegue en Vercel

Tambien se conserva la version Next.js/Supabase para publicar despues. La guia paso a paso esta en `DEPLOY.md`.
