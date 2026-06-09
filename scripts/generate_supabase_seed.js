const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DB_PATH = path.join(ROOT, "data", "db.json");
const OUTPUT_PATH = path.join(ROOT, "supabase", "seed.sql");
const USERS_OUTPUT_PATH = path.join(ROOT, "supabase", "seed_usuarios.sql");
const MATCHES_OUTPUT_PATH = path.join(ROOT, "supabase", "seed_partidos.sql");
const NAMESPACE = "3f4d0d4f-31d8-4d8e-9a31-2bd9d8871638";

function uuidFromName(name) {
  const namespace = Buffer.from(NAMESPACE.replace(/-/g, ""), "hex");
  const hash = crypto.createHash("sha1").update(namespace).update(name).digest();

  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;

  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function sqlString(value) {
  if (value === null || value === undefined || value === "") return "null";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlBool(value) {
  return value ? "true" : "false";
}

function buildInsert(table, columns, rows) {
  if (!rows.length) return "";

  const values = rows
    .map((row) => `  (${columns.map((column) => row[column]).join(", ")})`)
    .join(",\n");

  return `insert into public.${table} (${columns.join(", ")}) values\n${values};`;
}

const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));

const userRows = db.usuarios.map((user) => ({
  id: sqlString(uuidFromName(user.id || user.curp)),
  nombre: sqlString(user.nombre),
  curp: sqlString(user.curp),
  area: sqlString(user.area),
  activo: sqlBool(user.activo)
}));

const matchRows = db.partidos.map((match) => ({
  id: sqlString(uuidFromName(match.id)),
  grupo: sqlString(match.grupo),
  equipo_local: sqlString(match.equipo_local),
  equipo_visitante: sqlString(match.equipo_visitante),
  fecha_hora: sqlString(match.fecha_hora),
  sede: sqlString(match.sede),
  goles_local_real: match.goles_local_real === null ? "null" : Number(match.goles_local_real),
  goles_visitante_real: match.goles_visitante_real === null ? "null" : Number(match.goles_visitante_real),
  estatus: sqlString(match.estatus || "programado")
}));

const sql = `-- Datos iniciales generados desde data/db.json.
-- Usuarios: ${userRows.length}
-- Partidos: ${matchRows.length}

begin;

truncate table public.predicciones, public.partidos, public.usuarios restart identity cascade;

${buildInsert("usuarios", ["id", "nombre", "curp", "area", "activo"], userRows)}

${buildInsert(
  "partidos",
  [
    "id",
    "grupo",
    "equipo_local",
    "equipo_visitante",
    "fecha_hora",
    "sede",
    "goles_local_real",
    "goles_visitante_real",
    "estatus"
  ],
  matchRows
)}

commit;
`;

fs.writeFileSync(OUTPUT_PATH, `${sql}\n`, "utf8");
fs.writeFileSync(
  USERS_OUTPUT_PATH,
  `-- Carga solo usuarios generada desde data/db.json.
-- Usuarios: ${userRows.length}

begin;

truncate table public.predicciones, public.usuarios restart identity cascade;

${buildInsert("usuarios", ["id", "nombre", "curp", "area", "activo"], userRows)}

commit;
`,
  "utf8"
);
fs.writeFileSync(
  MATCHES_OUTPUT_PATH,
  `-- Carga solo partidos generada desde data/db.json.
-- Partidos: ${matchRows.length}

begin;

truncate table public.predicciones, public.partidos restart identity cascade;

${buildInsert(
  "partidos",
  [
    "id",
    "grupo",
    "equipo_local",
    "equipo_visitante",
    "fecha_hora",
    "sede",
    "goles_local_real",
    "goles_visitante_real",
    "estatus"
  ],
  matchRows
)}

commit;
`,
  "utf8"
);
console.log(`Seed generado: ${OUTPUT_PATH}`);
console.log(`Seed usuarios generado: ${USERS_OUTPUT_PATH}`);
console.log(`Seed partidos generado: ${MATCHES_OUTPUT_PATH}`);
console.log(`Usuarios: ${userRows.length}`);
console.log(`Partidos: ${matchRows.length}`);
