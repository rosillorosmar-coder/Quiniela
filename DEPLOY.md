# Publicar en web

Esta app esta lista para publicarse con Vercel y Supabase.

## 1. Supabase

1. Crea un proyecto en Supabase.
2. Abre SQL Editor.
3. Ejecuta `supabase/schema.sql`.
4. Ejecuta `supabase/seed.sql` para cargar el catalogo actual:
   - 261 usuarios activos.
   - 72 partidos de fase de grupos.
5. Copia estos valores:
   - Project URL
   - service_role key para uso del servidor

## 2. Variables de entorno

En Vercel agrega:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
ADMIN_PASSWORD=una-clave-segura
SESSION_SECRET=un-texto-largo-aleatorio
```

No publiques `SUPABASE_SERVICE_ROLE_KEY`. Solo va como variable secreta en Vercel.
`SESSION_SECRET` debe ser largo y aleatorio; por ejemplo, una cadena de 32 caracteres o mas.

## 3. GitHub

Sube esta carpeta a un repositorio de GitHub.

```bash
git add .
git commit -m "Crear quiniela mundial 2026"
git branch -M main
git remote add origin TU_URL_DE_GITHUB
git push -u origin main
```

## 4. Vercel

1. Entra a https://vercel.com.
2. New Project.
3. Importa el repositorio de GitHub.
4. Framework Preset: Next.js.
5. Node.js Version: 22.x.
6. Agrega las variables de entorno.
7. Deploy.

Al terminar, Vercel te dara una URL publica como:

```text
https://quiniela-mundial-2026.vercel.app
```

## 5. Despues de publicar

- Comparte la URL publica con los participantes.
- Los usuarios entran con su CURP.
- El ranking publico esta en `/ranking`.
- El panel administrador esta en `/admin`.
- En Admin puedes crear usuarios nuevos y capturar resultados reales.

## 6. Abrir localmente

Usa Node 22.13 o superior.

```bash
nvm install
nvm use
npm install
cp .env.example .env.local
npm run dev
```

Luego abre:

```text
http://localhost:3000
```
