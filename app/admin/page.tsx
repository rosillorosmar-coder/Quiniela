"use client";

import { FormEvent, useEffect, useState } from "react";
import { LockKeyhole, Save, ShieldCheck, UserPlus } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";

type AdminMatch = {
  id: string;
  grupo: string;
  equipo_local: string;
  equipo_visitante: string;
  fecha_hora_mx: string;
  sede?: string | null;
  goles_local_real: number | null;
  goles_visitante_real: number | null;
  estatus: string;
};

type ResultDraft = Record<string, { local: string; visitante: string }>;

type NewUser = {
  nombre: string;
  curp: string;
  area: string;
  activo: boolean;
};

const emptyUser: NewUser = {
  nombre: "",
  curp: "",
  area: "",
  activo: true
};

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [matches, setMatches] = useState<AdminMatch[]>([]);
  const [drafts, setDrafts] = useState<ResultDraft>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState("");
  const [newUser, setNewUser] = useState<NewUser>(emptyUser);
  const [creatingUser, setCreatingUser] = useState(false);

  async function loadMatches() {
    setLoading(true);
    setError("");
    const response = await fetch("/api/admin/matches");
    const payload = await response.json();
    setLoading(false);

    if (response.status === 401) {
      setAuthenticated(false);
      return;
    }

    if (!response.ok) {
      setError(payload.error ?? "No se pudieron cargar partidos.");
      return;
    }

    setAuthenticated(true);
    setMatches(payload.matches);
    setDrafts(
      Object.fromEntries(
        payload.matches.map((match: AdminMatch) => [
          match.id,
          {
            local: match.goles_local_real === null ? "" : String(match.goles_local_real),
            visitante: match.goles_visitante_real === null ? "" : String(match.goles_visitante_real)
          }
        ])
      )
    );
  }

  useEffect(() => {
    loadMatches();
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });

    const payload = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(payload.error ?? "No se pudo iniciar sesion de administrador.");
      return;
    }

    setPassword("");
    await loadMatches();
  }

  async function saveResult(matchId: string) {
    setError("");
    setSuccess("");
    setSavingId(matchId);

    const draft = drafts[matchId];
    const response = await fetch(`/api/admin/results/${matchId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        goles_local_real: Number(draft.local),
        goles_visitante_real: Number(draft.visitante)
      })
    });

    const payload = await response.json();
    setSavingId("");

    if (!response.ok) {
      setError(payload.error ?? "No se pudo guardar el resultado.");
      return;
    }

    setSuccess("Resultado guardado y puntos recalculados.");
    await loadMatches();
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setCreatingUser(true);

    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser)
    });

    const payload = await response.json();
    setCreatingUser(false);

    if (!response.ok) {
      setError(payload.error ?? "No se pudo crear el usuario.");
      return;
    }

    setNewUser(emptyUser);
    setSuccess(
      `${payload.user.nombre} fue registrado correctamente.${
        payload.totalUsuarios ? ` Total de usuarios: ${payload.totalUsuarios}.` : ""
      }`
    );
  }

  return (
    <main className="app-shell">
      <AppHeader />
      <section className="page">
        {!authenticated ? (
          <form className="auth-card" onSubmit={login}>
            <LockKeyhole size={30} color="var(--primary)" aria-hidden="true" />
            <h1>Panel administrador</h1>
            <p className="muted">Captura resultados reales y recalcula puntos automaticamente.</p>

            <div className="field">
              <label htmlFor="password">Clave de administrador</label>
              <input
                className="input"
                id="password"
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </div>

            {error ? <p className="error">{error}</p> : null}

            <button className="button button-primary" disabled={loading} type="submit">
              <ShieldCheck size={17} aria-hidden="true" />
              {loading ? "Validando..." : "Entrar"}
            </button>
          </form>
        ) : (
          <div className="panel">
            <div className="panel-header">
              <div>
                <h1>Panel administrador</h1>
                <p className="muted">Alta de participantes y captura de resultados reales.</p>
              </div>
            </div>

            {loading ? <p className="notice">Cargando partidos...</p> : null}
            {error ? <p className="error">{error}</p> : null}
            {success ? <p className="success">{success}</p> : null}

            <section className="admin-section" aria-labelledby="user-create-title">
              <div>
                <h2 id="user-create-title">Alta de usuario</h2>
                <p className="muted">Registra personal que no aparezca en el catalogo inicial.</p>
              </div>

              <form className="user-create-form" onSubmit={createUser}>
                <div className="field compact-field">
                  <label htmlFor="new-user-name">Nombre completo</label>
                  <input
                    className="input"
                    id="new-user-name"
                    onChange={(event) => setNewUser((current) => ({ ...current, nombre: event.target.value }))}
                    placeholder="Nombre del participante"
                    required
                    value={newUser.nombre}
                  />
                </div>

                <div className="field compact-field">
                  <label htmlFor="new-user-curp">CURP</label>
                  <input
                    className="input"
                    id="new-user-curp"
                    maxLength={18}
                    minLength={18}
                    onChange={(event) => setNewUser((current) => ({ ...current, curp: event.target.value }))}
                    placeholder="CURP a 18 caracteres"
                    required
                    value={newUser.curp}
                  />
                </div>

                <div className="field compact-field">
                  <label htmlFor="new-user-area">Area</label>
                  <input
                    className="input"
                    id="new-user-area"
                    onChange={(event) => setNewUser((current) => ({ ...current, area: event.target.value }))}
                    placeholder="Area o departamento"
                    required
                    value={newUser.area}
                  />
                </div>

                <label className="check-field" htmlFor="new-user-active">
                  <input
                    checked={newUser.activo}
                    id="new-user-active"
                    onChange={(event) => setNewUser((current) => ({ ...current, activo: event.target.checked }))}
                    type="checkbox"
                  />
                  <span>Usuario activo</span>
                </label>

                <button className="button button-primary" disabled={creatingUser} type="submit">
                  <UserPlus size={17} aria-hidden="true" />
                  {creatingUser ? "Creando..." : "Crear usuario"}
                </button>
              </form>
            </section>

            <section className="admin-section" aria-labelledby="results-title">
              <div>
                <h2 id="results-title">Resultados reales</h2>
                <p className="muted">Guardar un resultado final recalcula todos los puntos del partido.</p>
              </div>

              <div className="admin-results">
                {matches.map((match) => (
                  <article className="match-row admin-row" key={match.id}>
                    <div className="match-meta">
                      Grupo {match.grupo}
                      <br />
                      {match.fecha_hora_mx}
                      {match.sede ? (
                        <>
                          <br />
                          {match.sede}
                        </>
                      ) : null}
                      <br />
                      {match.estatus}
                    </div>
                    <div className="team-name">
                      {match.equipo_local} vs {match.equipo_visitante}
                    </div>
                    <input
                      aria-label={`Goles reales de ${match.equipo_local}`}
                      className="score-input"
                      inputMode="numeric"
                      min={0}
                      max={30}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [match.id]: { ...current[match.id], local: event.target.value }
                        }))
                      }
                      type="number"
                      value={drafts[match.id]?.local ?? ""}
                    />
                    <input
                      aria-label={`Goles reales de ${match.equipo_visitante}`}
                      className="score-input"
                      inputMode="numeric"
                      min={0}
                      max={30}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [match.id]: { ...current[match.id], visitante: event.target.value }
                        }))
                      }
                      type="number"
                      value={drafts[match.id]?.visitante ?? ""}
                    />
                    <button
                      className="button button-primary"
                      disabled={savingId === match.id}
                      onClick={() => saveResult(match.id)}
                      type="button"
                    >
                      <Save size={17} aria-hidden="true" />
                      {savingId === match.id ? "..." : "Guardar"}
                    </button>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
