const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const os = require("os");
const { spawnSync } = require("child_process");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const ADMIN_TOKENS = new Set();
const TIME_ZONE = "America/Mexico_City";
const DEADLINE_UTC = new Date("2026-06-11T19:00:00.000Z");
const DEADLINE_LABEL = "11 de junio de 2026, 13:00";
const DB_PATH = path.join(__dirname, "data", "db.json");
const PUBLIC_DIR = path.join(__dirname, "local-public");
const PARSE_USERS_SCRIPT = path.join(__dirname, "scripts", "parse_users_from_xlsx.py");
const BUNDLED_PYTHON =
  "/Users/marcoantoniorosillomontalvo/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";

function readDb() {
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function normalizeCurp(curp) {
  return String(curp || "").trim().toUpperCase().replace(/\s+/g, "");
}

function normalizeAdminUser(user) {
  return String(user || "").trim().toLowerCase();
}

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function createAdminToken() {
  const token = crypto.randomBytes(24).toString("hex");
  ADMIN_TOKENS.add(token);
  return token;
}

function isValidAdminToken(token) {
  return Boolean(token && ADMIN_TOKENS.has(token));
}

function isClosed() {
  return Date.now() > DEADLINE_UTC.getTime();
}

function formatMxDate(value) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TIME_ZONE
  }).format(new Date(value));
}

function resultType(local, visitante) {
  if (local > visitante) return "local";
  if (local < visitante) return "visitante";
  return "empate";
}

function calculatePoints(prediction, match) {
  if (match.goles_local_real === null || match.goles_visitante_real === null) return null;
  if (
    prediction.goles_local_pred === match.goles_local_real &&
    prediction.goles_visitante_pred === match.goles_visitante_real
  ) {
    return 6;
  }

  return resultType(prediction.goles_local_pred, prediction.goles_visitante_pred) ===
    resultType(match.goles_local_real, match.goles_visitante_real)
    ? 3
    : 0;
}

function publicUser(user) {
  return {
    id: user.id,
    nombre: user.nombre,
    area: user.area
  };
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function readBuffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function getMultipartBoundary(contentType) {
  const match = String(contentType || "").match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  return match ? match[1] || match[2] : "";
}

async function readMultipart(req) {
  const boundaryValue = getMultipartBoundary(req.headers["content-type"]);
  if (!boundaryValue) return { fields: {}, files: {} };

  const body = await readBuffer(req);
  const delimiter = Buffer.from(`--${boundaryValue}`);
  const headerBreak = Buffer.from("\r\n\r\n");
  const nextDelimiter = Buffer.from(`\r\n--${boundaryValue}`);
  const fields = {};
  const files = {};
  let cursor = 0;

  while (cursor < body.length) {
    const boundaryStart = body.indexOf(delimiter, cursor);
    if (boundaryStart === -1) break;

    let partStart = boundaryStart + delimiter.length;
    if (body.slice(partStart, partStart + 2).toString("latin1") === "--") break;
    if (body.slice(partStart, partStart + 2).toString("latin1") === "\r\n") partStart += 2;

    const headerEnd = body.indexOf(headerBreak, partStart);
    if (headerEnd === -1) break;

    const headersText = body.slice(partStart, headerEnd).toString("latin1");
    const contentStart = headerEnd + headerBreak.length;
    const contentEnd = body.indexOf(nextDelimiter, contentStart);
    if (contentEnd === -1) break;

    const disposition = headersText.match(/content-disposition:[^\r\n]+/i)?.[0] || "";
    const name = disposition.match(/name="([^"]+)"/i)?.[1];
    const filename = disposition.match(/filename="([^"]*)"/i)?.[1];
    const content = body.slice(contentStart, contentEnd);

    if (name && filename) {
      files[name] = { filename, data: content };
    } else if (name) {
      fields[name] = content.toString("utf8").trim();
    }

    cursor = contentEnd + 2;
  }

  return { fields, files };
}

function parseUsersExcel(fileBuffer, filename) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "quiniela-users-"));
  const tempFile = path.join(tempDir, filename.replace(/[^a-z0-9_.-]/gi, "_") || "usuarios.xlsx");
  fs.writeFileSync(tempFile, fileBuffer);

  try {
    const python = fs.existsSync(BUNDLED_PYTHON) ? BUNDLED_PYTHON : "python3";
    const result = spawnSync(python, [PARSE_USERS_SCRIPT, tempFile], {
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024
    });

    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error((result.stderr || result.stdout || "No se pudo leer el Excel.").trim());
    }

    return JSON.parse(result.stdout || "{}");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function validGoal(value) {
  return Number.isInteger(value) && value >= 0 && value <= 30;
}

function getSortedMatches(db) {
  return [...db.partidos]
    .sort((a, b) => {
      const dateOrder = new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime();
      return dateOrder || a.grupo.localeCompare(b.grupo);
    })
    .map((match) => ({
      ...match,
      fecha_hora_mx: formatMxDate(match.fecha_hora)
    }));
}

function buildRanking(db) {
  return db.usuarios
    .filter((user) => user.activo)
    .map((user) => {
      const userPredictions = db.predicciones.filter((prediction) => prediction.id_usuario === user.id);
      return {
        id_usuario: user.id,
        nombre: user.nombre,
        area: user.area,
        predicciones_capturadas: userPredictions.length,
        puntos_totales: userPredictions.reduce((sum, prediction) => sum + (prediction.puntos || 0), 0),
        marcadores_exactos: userPredictions.filter((prediction) => prediction.puntos === 6).length,
        resultados_acertados: userPredictions.filter((prediction) => prediction.puntos === 3).length,
        partidos_sin_puntos: userPredictions.filter((prediction) => prediction.puntos === 0).length
      };
    })
    .filter((row) => row.predicciones_capturadas > 0)
    .sort(
      (a, b) =>
        b.puntos_totales - a.puntos_totales ||
        b.marcadores_exactos - a.marcadores_exactos ||
        a.nombre.localeCompare(b.nombre)
    );
}

function serveStatic(req, res) {
  const requested = new URL(req.url, `http://${req.headers.host}`).pathname;
  const cleanPath = requested === "/" ? "/index.html" : requested;
  const filePath = path.normalize(path.join(PUBLIC_DIR, cleanPath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      fs.readFile(path.join(PUBLIC_DIR, "index.html"), (fallbackError, fallback) => {
        if (fallbackError) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store"
        });
        res.end(fallback);
      });
      return;
    }

    const ext = path.extname(filePath);
    const type =
      ext === ".css"
        ? "text/css; charset=utf-8"
        : ext === ".js"
          ? "text/javascript; charset=utf-8"
          : "text/html; charset=utf-8";

    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
    res.end(content);
  });
}

async function handleApi(req, res, pathname) {
  const db = readDb();

  if (req.method === "GET" && pathname === "/api/config") {
    return sendJson(res, 200, {
      closed: isClosed(),
      deadlineLabel: DEADLINE_LABEL
    });
  }

  if (req.method === "POST" && pathname === "/api/session") {
    const body = await readBody(req);
    const curp = normalizeCurp(body.curp);
    const user = db.usuarios.find((item) => normalizeCurp(item.curp) === curp);

    if (!user || !user.activo) {
      return sendJson(res, 403, { error: "La CURP no esta registrada como participante activo." });
    }

    return sendJson(res, 200, { user: publicUser(user) });
  }

  if (req.method === "GET" && pathname === "/api/predictions") {
    const userId = new URL(req.url, `http://${req.headers.host}`).searchParams.get("userId");
    const user = db.usuarios.find((item) => item.id === userId && item.activo);

    if (!user) return sendJson(res, 401, { error: "Participante no valido." });

    const matches = getSortedMatches(db).map((match) => ({
      ...match,
      prediction:
        db.predicciones.find(
          (prediction) => prediction.id_usuario === user.id && prediction.id_partido === match.id
        ) || null
    }));

    return sendJson(res, 200, {
      user: publicUser(user),
      closed: isClosed(),
      deadlineLabel: DEADLINE_LABEL,
      matches
    });
  }

  if (req.method === "PUT" && pathname === "/api/predictions") {
    if (isClosed()) {
      return sendJson(res, 403, {
        error: `La captura cerro el ${DEADLINE_LABEL} hora de Mexico.`
      });
    }

    const body = await readBody(req);
    const user = db.usuarios.find((item) => item.id === body.userId && item.activo);
    const predictions = Array.isArray(body.predictions) ? body.predictions : [];

    if (!user) return sendJson(res, 401, { error: "Participante no valido." });

    const seen = new Set();
    for (const prediction of predictions) {
      const local = Number(prediction.goles_local_pred);
      const visitante = Number(prediction.goles_visitante_pred);
      const match = db.partidos.find((item) => item.id === prediction.id_partido);

      if (!match || seen.has(match.id)) {
        return sendJson(res, 400, { error: "Hay partidos duplicados o invalidos." });
      }
      if (!validGoal(local) || !validGoal(visitante)) {
        return sendJson(res, 400, { error: "Los marcadores deben ser enteros entre 0 y 30." });
      }

      seen.add(match.id);
    }

    for (const prediction of predictions) {
      const match = db.partidos.find((item) => item.id === prediction.id_partido);
      const existing = db.predicciones.find(
        (item) => item.id_usuario === user.id && item.id_partido === match.id
      );
      const now = new Date().toISOString();

      if (existing) {
        existing.goles_local_pred = Number(prediction.goles_local_pred);
        existing.goles_visitante_pred = Number(prediction.goles_visitante_pred);
        existing.puntos = calculatePoints(existing, match);
        existing.fecha_actualizacion = now;
      } else {
        const row = {
          id: crypto.randomUUID(),
          id_usuario: user.id,
          id_partido: match.id,
          goles_local_pred: Number(prediction.goles_local_pred),
          goles_visitante_pred: Number(prediction.goles_visitante_pred),
          puntos: null,
          fecha_registro: now,
          fecha_actualizacion: now
        };
        row.puntos = calculatePoints(row, match);
        db.predicciones.push(row);
      }
    }

    writeDb(db);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "GET" && pathname === "/api/ranking") {
    return sendJson(res, 200, { ranking: buildRanking(db) });
  }

  if (req.method === "POST" && pathname === "/api/admin/login") {
    const body = await readBody(req);
    const username = normalizeAdminUser(body.username);
    const password = String(body.password || "");
    const admin = (db.admins || []).find((item) => normalizeAdminUser(item.usuario) === username);

    if (!admin || !admin.activo || admin.password !== password) {
      return sendJson(res, 401, { error: "Usuario o clave de administrador incorrectos." });
    }

    return sendJson(res, 200, {
      token: createAdminToken(),
      admin: {
        usuario: admin.usuario,
        nombre: admin.nombre
      }
    });
  }

  if (req.method === "GET" && pathname === "/api/admin/matches") {
    const token = new URL(req.url, `http://${req.headers.host}`).searchParams.get("token");
    if (!isValidAdminToken(token)) return sendJson(res, 401, { error: "Administrador requerido." });
    return sendJson(res, 200, { matches: getSortedMatches(db) });
  }

  if (req.method === "POST" && pathname === "/api/admin/users") {
    const body = await readBody(req);
    if (!isValidAdminToken(body.token)) return sendJson(res, 401, { error: "Administrador requerido." });

    const nombre = normalizeText(body.nombre).toUpperCase();
    const curp = normalizeCurp(body.curp);
    const area = normalizeText(body.area).toUpperCase() || "SIN AREA";
    const activo = body.activo !== false;

    if (!nombre) return sendJson(res, 400, { error: "Captura el nombre del usuario." });
    if (curp.length !== 18) return sendJson(res, 400, { error: "La CURP debe tener 18 caracteres." });

    const exists = db.usuarios.some((user) => normalizeCurp(user.curp) === curp);
    if (exists) return sendJson(res, 409, { error: "Ya existe un usuario registrado con esa CURP." });

    const user = {
      id: `u-${curp}`,
      nombre,
      curp,
      area,
      activo
    };

    db.usuarios.push(user);
    db.usuarios.sort((a, b) => (a.activo === b.activo ? a.nombre.localeCompare(b.nombre) : a.activo ? -1 : 1));

    writeDb(db);
    return sendJson(res, 201, { user: publicUser(user), totalUsuarios: db.usuarios.length });
  }

  if (req.method === "POST" && pathname === "/api/admin/users/import") {
    const { fields, files } = await readMultipart(req);
    if (!isValidAdminToken(fields.token)) return sendJson(res, 401, { error: "Administrador requerido." });

    const upload = files.file || files.usersFile;
    if (!upload || !upload.data.length) return sendJson(res, 400, { error: "Selecciona un archivo Excel." });
    if (!/\.xlsx$/i.test(upload.filename || "")) {
      return sendJson(res, 400, { error: "El archivo debe ser .xlsx." });
    }

    let parsed;
    try {
      parsed = parseUsersExcel(upload.data, upload.filename);
    } catch (error) {
      return sendJson(res, 400, { error: error.message || "No se pudo leer el Excel." });
    }

    const usersFromExcel = Array.isArray(parsed.users) ? parsed.users : [];
    const existingCurps = new Set(db.usuarios.map((user) => normalizeCurp(user.curp)));
    let imported = 0;
    let existing = 0;
    let skipped = Number(parsed.skipped || 0);

    for (const item of usersFromExcel) {
      const nombre = normalizeText(item.nombre).toUpperCase();
      const curp = normalizeCurp(item.curp);
      const area = normalizeText(item.area).toUpperCase() || "SIN AREA";

      if (!nombre || curp.length !== 18) {
        skipped += 1;
        continue;
      }

      if (existingCurps.has(curp)) {
        existing += 1;
        continue;
      }

      db.usuarios.push({
        id: `u-${curp}`,
        nombre,
        curp,
        area,
        activo: item.activo !== false
      });
      existingCurps.add(curp);
      imported += 1;
    }

    db.usuarios.sort((a, b) => (a.activo === b.activo ? a.nombre.localeCompare(b.nombre) : a.activo ? -1 : 1));

    writeDb(db);
    return sendJson(res, 200, {
      imported,
      existing,
      skipped,
      totalUsuarios: db.usuarios.length
    });
  }

  if (req.method === "PUT" && pathname.startsWith("/api/admin/results/")) {
    const body = await readBody(req);
    if (!isValidAdminToken(body.token)) return sendJson(res, 401, { error: "Administrador requerido." });

    const matchId = pathname.split("/").pop();
    const match = db.partidos.find((item) => item.id === matchId);
    const local = Number(body.goles_local_real);
    const visitante = Number(body.goles_visitante_real);

    if (!match) return sendJson(res, 404, { error: "Partido no encontrado." });
    if (!validGoal(local) || !validGoal(visitante)) {
      return sendJson(res, 400, { error: "Captura marcadores enteros entre 0 y 30." });
    }

    match.goles_local_real = local;
    match.goles_visitante_real = visitante;
    match.estatus = "finalizado";

    for (const prediction of db.predicciones.filter((item) => item.id_partido === match.id)) {
      prediction.puntos = calculatePoints(prediction, match);
      prediction.fecha_actualizacion = new Date().toISOString();
    }

    writeDb(db);
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 404, { error: "Ruta no encontrada." });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/")) {
    await handleApi(req, res, url.pathname);
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`Quiniela Mundial 2026 local: http://localhost:${PORT}`);
  console.log(`Admin local: http://localhost:${PORT}/admin`);
  console.log("Admin por defecto: admin / admin2026");
});
