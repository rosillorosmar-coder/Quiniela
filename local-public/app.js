const state = {
  user: JSON.parse(localStorage.getItem("quinielaUser") || "null"),
  adminToken: localStorage.getItem("quinielaAdminToken") || "",
  admin: JSON.parse(localStorage.getItem("quinielaAdmin") || "null"),
  matches: [],
  drafts: {}
};

const views = {
  login: document.querySelector("#view-login"),
  predictions: document.querySelector("#view-predictions"),
  ranking: document.querySelector("#view-ranking"),
  admin: document.querySelector("#view-admin")
};

function show(id) {
  Object.values(views).forEach((view) => view.classList.add("hidden"));
  views[id].classList.remove("hidden");

  if (id === "predictions") loadPredictions();
  if (id === "ranking") loadRanking();
  if (id === "admin" && state.adminToken) loadAdminMatches();
}

function setMessage(selector, text) {
  const element = document.querySelector(selector);
  element.textContent = text || "";
  element.classList.toggle("hidden", !text);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Ocurrio un error.");
  return payload;
}

function normalizeCurp(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
}

function scoreBadge(points) {
  if (points === 6) return '<span class="score-badge exact">6 pts</span>';
  if (points === 3) return '<span class="score-badge result">3 pts</span>';
  if (points === 0) return '<span class="score-badge zero">0 pts</span>';
  return '<span class="muted">Sin calificar</span>';
}

function realScore(value) {
  return value === null || value === undefined ? "-" : String(value);
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    const view = button.dataset.view;
    if (view === "predictions" && !state.user) {
      show("login");
      return;
    }
    show(view);
  });
});

document.querySelector("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("#login-error", "");

  try {
    const payload = await api("/api/session", {
      method: "POST",
      body: JSON.stringify({ curp: normalizeCurp(document.querySelector("#curp").value) })
    });
    state.user = payload.user;
    localStorage.setItem("quinielaUser", JSON.stringify(payload.user));
    show("predictions");
  } catch (error) {
    setMessage("#login-error", error.message);
  }
});

document.querySelector("#logout-button").addEventListener("click", () => {
  state.user = null;
  localStorage.removeItem("quinielaUser");
  show("login");
});

async function loadPredictions() {
  if (!state.user) {
    show("login");
    return;
  }

  setMessage("#predictions-error", "");
  setMessage("#predictions-success", "");

  try {
    const payload = await api(`/api/predictions?userId=${encodeURIComponent(state.user.id)}`);
    state.matches = payload.matches;
    state.drafts = Object.fromEntries(
      payload.matches.map((match) => [
        match.id,
        {
          local:
            match.prediction && match.prediction.goles_local_pred !== null
              ? String(match.prediction.goles_local_pred)
              : "",
          visitante:
            match.prediction && match.prediction.goles_visitante_pred !== null
              ? String(match.prediction.goles_visitante_pred)
              : ""
        }
      ])
    );

    const completed = payload.matches.filter((match) => {
      const draft = state.drafts[match.id];
      return draft.local !== "" && draft.visitante !== "";
    }).length;

    document.querySelector("#welcome-title").textContent = `Hola, ${payload.user.nombre}`;
    document.querySelector("#capture-summary").textContent =
      `${payload.user.area} - ${completed} de ${payload.matches.length} partidos capturados`;
    document.querySelector("#deadline-notice").textContent = payload.closed
      ? `La captura y edicion cerraron el ${payload.deadlineLabel} hora de Mexico.`
      : `Puedes editar tus predicciones hasta el ${payload.deadlineLabel} hora de Mexico.`;
    document.querySelector("#save-predictions").disabled = payload.closed;
    renderMatches(payload.closed);
  } catch (error) {
    if (error.message.includes("Participante no valido")) {
      state.user = null;
      localStorage.removeItem("quinielaUser");
      show("login");
      return;
    }
    setMessage("#predictions-error", error.message);
  }
}

function renderMatches(closed) {
  document.querySelector("#matches-list").innerHTML = state.matches
    .map((match) => {
      const draft = state.drafts[match.id] || { local: "", visitante: "" };
      return `
        <article class="match-row">
          <div class="match-meta">
            Grupo ${match.grupo}<br />
            ${match.fecha_hora_mx}${match.sede ? `<br />${match.sede}` : ""}
          </div>
          <div class="teams">
            <div class="score-headings" aria-hidden="true">
              <span></span>
              <span>Pred.</span>
              <span>Real</span>
            </div>
            <label class="team-line">
              <span class="team-name">${match.equipo_local}</span>
              <input class="score-input" type="number" min="0" max="30" inputmode="numeric"
                data-score="${match.id}" data-side="local" value="${draft.local}" ${closed ? "disabled" : ""} required />
              <span class="real-score">${realScore(match.goles_local_real)}</span>
            </label>
            <label class="team-line">
              <span class="team-name">${match.equipo_visitante}</span>
              <input class="score-input" type="number" min="0" max="30" inputmode="numeric"
                data-score="${match.id}" data-side="visitante" value="${draft.visitante}" ${closed ? "disabled" : ""} required />
              <span class="real-score">${realScore(match.goles_visitante_real)}</span>
            </label>
          </div>
          <div>${scoreBadge(match.prediction ? match.prediction.puntos : null)}</div>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll("[data-score]").forEach((input) => {
    input.addEventListener("input", () => {
      const id = input.dataset.score;
      const side = input.dataset.side;
      state.drafts[id][side] = input.value;
    });
  });
}

document.querySelector("#predictions-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("#predictions-error", "");
  setMessage("#predictions-success", "");

  const predictions = Object.entries(state.drafts).map(([id_partido, draft]) => ({
    id_partido,
    goles_local_pred: Number(draft.local),
    goles_visitante_pred: Number(draft.visitante)
  }));

  if (Object.values(state.drafts).some((draft) => draft.local === "" || draft.visitante === "")) {
    setMessage("#predictions-error", "Captura marcador local y visitante en todos los partidos.");
    return;
  }

  try {
    await api("/api/predictions", {
      method: "PUT",
      body: JSON.stringify({ userId: state.user.id, predictions })
    });
    await loadPredictions();
    setMessage("#predictions-success", "Predicciones guardadas correctamente.");
  } catch (error) {
    setMessage("#predictions-error", error.message);
  }
});

async function loadRanking() {
  setMessage("#ranking-error", "");
  try {
    const payload = await api("/api/ranking");
    const total = payload.ranking.length;
    document.querySelector("#ranking-count").textContent =
      `${total} ${total === 1 ? "participante" : "participantes"}`;
    document.querySelector("#ranking-table").innerHTML = `
      <div class="ranking-row header">
        <span>#</span>
        <span>Participante</span>
        <span class="metric">Puntos</span>
        <span class="metric">Exactos</span>
        <span class="metric">Resultado</span>
        <span class="metric">Sin puntos</span>
      </div>
      ${payload.ranking
        .map(
          (row, index) => `
            <article class="ranking-row">
              <span class="rank-number">${index + 1}</span>
              <span><strong>${row.nombre}</strong><br /><span class="muted">${row.area}</span></span>
              <span class="metric">${row.puntos_totales}</span>
              <span class="metric">${row.marcadores_exactos}</span>
              <span class="metric">${row.resultados_acertados}</span>
              <span class="metric">${row.partidos_sin_puntos}</span>
            </article>
          `
        )
        .join("")}
    `;
  } catch (error) {
    setMessage("#ranking-error", error.message);
  }
}

document.querySelector("#refresh-ranking").addEventListener("click", loadRanking);

document.querySelector("#admin-login").addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("#admin-login-error", "");

  try {
    const payload = await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({
        username: document.querySelector("#admin-username").value,
        password: document.querySelector("#admin-password").value
      })
    });
    state.adminToken = payload.token;
    state.admin = payload.admin;
    localStorage.setItem("quinielaAdminToken", payload.token);
    localStorage.setItem("quinielaAdmin", JSON.stringify(payload.admin));
    await loadAdminMatches();
  } catch (error) {
    setMessage("#admin-login-error", error.message);
  }
});

document.querySelector("#user-create-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("#user-create-error", "");
  setMessage("#user-create-success", "");
  setMessage("#user-import-error", "");
  setMessage("#user-import-success", "");

  const form = event.currentTarget;
  const nombre = document.querySelector("#new-user-name").value;
  const curp = normalizeCurp(document.querySelector("#new-user-curp").value);
  const area = document.querySelector("#new-user-area").value;
  const activo = document.querySelector("#new-user-active").checked;

  try {
    const payload = await api("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        token: state.adminToken,
        nombre,
        curp,
        area,
        activo
      })
    });

    form.reset();
    document.querySelector("#new-user-active").checked = true;
    setMessage(
      "#user-create-success",
      `${payload.user.nombre} fue registrado correctamente. Total de usuarios: ${payload.totalUsuarios}.`
    );
  } catch (error) {
    setMessage("#user-create-error", error.message);
  }
});

document.querySelector("#user-import-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("#user-import-error", "");
  setMessage("#user-import-success", "");
  setMessage("#user-create-error", "");
  setMessage("#user-create-success", "");

  const form = event.currentTarget;
  const fileInput = document.querySelector("#users-excel");
  const file = fileInput.files[0];
  if (!file) {
    setMessage("#user-import-error", "Selecciona un archivo Excel.");
    return;
  }

  const data = new FormData();
  data.append("token", state.adminToken);
  data.append("file", file);

  try {
    const response = await fetch("/api/admin/users/import", {
      method: "POST",
      body: data
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "No se pudo importar el Excel.");

    form.reset();
    setMessage(
      "#user-import-success",
      `Importacion lista: ${payload.imported} nuevos, ${payload.existing} ya existian, ${payload.skipped} omitidos. Total de usuarios: ${payload.totalUsuarios}.`
    );
  } catch (error) {
    setMessage("#user-import-error", error.message);
  }
});

async function loadAdminMatches() {
  try {
    const payload = await api(`/api/admin/matches?token=${encodeURIComponent(state.adminToken)}`);
    document.querySelector("#admin-login").classList.add("hidden");
    document.querySelector("#admin-panel").classList.remove("hidden");
    renderAdminMatches(payload.matches);
  } catch {
    state.adminToken = "";
    state.admin = null;
    localStorage.removeItem("quinielaAdminToken");
    localStorage.removeItem("quinielaAdmin");
    document.querySelector("#admin-login").classList.remove("hidden");
    document.querySelector("#admin-panel").classList.add("hidden");
  }
}

function renderAdminMatches(matches) {
  document.querySelector("#admin-matches").innerHTML = matches
    .map(
      (match) => `
        <article class="match-row admin-row">
          <div class="match-meta">
            Grupo ${match.grupo}<br />
            ${match.fecha_hora_mx}<br />
            ${match.sede ? `${match.sede}<br />` : ""}
            ${match.estatus}
          </div>
          <div class="team-name">${match.equipo_local} vs ${match.equipo_visitante}</div>
          <input class="score-input" type="number" min="0" max="30" value="${match.goles_local_real ?? ""}" data-admin="${match.id}" data-side="local" />
          <input class="score-input" type="number" min="0" max="30" value="${match.goles_visitante_real ?? ""}" data-admin="${match.id}" data-side="visitante" />
          <button class="button button-primary" type="button" data-save-result="${match.id}">Guardar</button>
        </article>
      `
    )
    .join("");

  document.querySelectorAll("[data-save-result]").forEach((button) => {
    button.addEventListener("click", () => saveResult(button.dataset.saveResult));
  });
}

async function saveResult(matchId) {
  setMessage("#admin-error", "");
  setMessage("#admin-success", "");

  const local = document.querySelector(`[data-admin="${matchId}"][data-side="local"]`).value;
  const visitante = document.querySelector(`[data-admin="${matchId}"][data-side="visitante"]`).value;

  try {
    await api(`/api/admin/results/${matchId}`, {
      method: "PUT",
      body: JSON.stringify({
        token: state.adminToken,
        goles_local_real: Number(local),
        goles_visitante_real: Number(visitante)
      })
    });
    setMessage("#admin-success", "Resultado guardado y puntos recalculados.");
    await loadAdminMatches();
  } catch (error) {
    setMessage("#admin-error", error.message);
  }
}

if (state.user) {
  show("predictions");
} else {
  show("login");
}
