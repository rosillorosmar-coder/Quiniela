"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Save, ShieldAlert } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";

type Match = {
  id: string;
  grupo: string;
  equipo_local: string;
  equipo_visitante: string;
  fecha_hora_mx: string;
  sede?: string | null;
  goles_local_real: number | null;
  goles_visitante_real: number | null;
  estatus: string;
  prediction: {
    goles_local_pred: number | null;
    goles_visitante_pred: number | null;
    puntos: number | null;
  } | null;
};

type ApiState = {
  closed: boolean;
  deadlineLabel: string;
  user: {
    nombre: string;
    area: string;
  };
  matches: Match[];
};

type Scores = Record<string, { local: string; visitante: string }>;

function badgeClass(points: number | null) {
  if (points === 6) return "score-badge exact";
  if (points === 3) return "score-badge result";
  return "score-badge zero";
}

function realScore(value: number | null) {
  return value === null ? "-" : String(value);
}

export default function PredictionsPage() {
  const router = useRouter();
  const [data, setData] = useState<ApiState | null>(null);
  const [scores, setScores] = useState<Scores>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/predictions");
      if (response.status === 401) {
        router.push("/");
        return;
      }

      const payload = await response.json();
      setLoading(false);

      if (!response.ok) {
        setError(payload.error ?? "No se pudieron cargar predicciones.");
        return;
      }

      setData(payload);
      setScores(
        Object.fromEntries(
          payload.matches.map((match: Match) => [
            match.id,
            {
              local:
                match.prediction?.goles_local_pred === null ||
                match.prediction?.goles_local_pred === undefined
                  ? ""
                  : String(match.prediction.goles_local_pred),
              visitante:
                match.prediction?.goles_visitante_pred === null ||
                match.prediction?.goles_visitante_pred === undefined
                  ? ""
                  : String(match.prediction.goles_visitante_pred)
            }
          ])
        )
      );
    }

    load();
  }, [router]);

  const completed = useMemo(() => {
    if (!data) return 0;
    return data.matches.filter((match) => {
      const score = scores[match.id];
      return score?.local !== "" && score?.visitante !== "";
    }).length;
  }, [data, scores]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    const predictions = Object.entries(scores).map(([id_partido, score]) => ({
      id_partido,
      goles_local_pred: Number(score.local),
      goles_visitante_pred: Number(score.visitante)
    }));

    const hasEmpty = Object.values(scores).some((score) => score.local === "" || score.visitante === "");
    if (hasEmpty) {
      setSaving(false);
      setError("Captura marcador local y visitante en todos los partidos.");
      return;
    }

    const response = await fetch("/api/predictions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ predictions })
    });

    const payload = await response.json();
    setSaving(false);

    if (!response.ok) {
      setError(payload.error ?? "No se pudieron guardar las predicciones.");
      return;
    }

    setSuccess("Predicciones guardadas correctamente.");
  }

  async function logout() {
    await fetch("/api/session", { method: "DELETE" });
    router.push("/");
  }

  return (
    <main className="app-shell">
      <AppHeader />
      <section className="page">
        {loading ? <p className="notice">Cargando partidos...</p> : null}
        {error ? <p className="error">{error}</p> : null}

        {data ? (
          <form className="panel" onSubmit={submit}>
            <div className="panel-header">
              <div>
                <h1>Hola, {data.user.nombre}</h1>
                <p className="muted">
                  {data.user.area} · {completed} de {data.matches.length} partidos capturados
                </p>
              </div>
              <button className="button button-secondary" onClick={logout} type="button">
                <LogOut size={17} aria-hidden="true" />
                Salir
              </button>
            </div>

            {data.closed ? (
              <p className="notice">
                <ShieldAlert size={16} aria-hidden="true" /> La captura y edicion cerraron el{" "}
                {data.deadlineLabel} hora de Mexico.
              </p>
            ) : (
              <p className="notice">
                Puedes editar tus predicciones hasta el {data.deadlineLabel} hora de Mexico.
              </p>
            )}

            {success ? <p className="success">{success}</p> : null}

            <div className="match-list">
              {data.matches.map((match) => (
                <article className="match-row" key={match.id}>
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
                  </div>

                  <div className="teams">
                    <div className="score-headings" aria-hidden="true">
                      <span />
                      <span>Pred.</span>
                      <span>Real</span>
                    </div>
                    <label className="team-line">
                      <span className="team-name">{match.equipo_local}</span>
                      <input
                        className="score-input"
                        disabled={data.closed}
                        inputMode="numeric"
                        min={0}
                        max={30}
                        onChange={(event) =>
                          setScores((current) => ({
                            ...current,
                            [match.id]: {
                              ...current[match.id],
                              local: event.target.value
                            }
                          }))
                        }
                        required
                        type="number"
                        value={scores[match.id]?.local ?? ""}
                      />
                      <span className="real-score">{realScore(match.goles_local_real)}</span>
                    </label>
                    <label className="team-line">
                      <span className="team-name">{match.equipo_visitante}</span>
                      <input
                        className="score-input"
                        disabled={data.closed}
                        inputMode="numeric"
                        min={0}
                        max={30}
                        onChange={(event) =>
                          setScores((current) => ({
                            ...current,
                            [match.id]: {
                              ...current[match.id],
                              visitante: event.target.value
                            }
                          }))
                        }
                        required
                        type="number"
                        value={scores[match.id]?.visitante ?? ""}
                      />
                      <span className="real-score">{realScore(match.goles_visitante_real)}</span>
                    </label>
                  </div>

                  <div>
                    {match.prediction?.puntos !== null && match.prediction?.puntos !== undefined ? (
                      <span className={badgeClass(match.prediction.puntos)}>
                        {match.prediction.puntos} pts
                      </span>
                    ) : (
                      <span className="muted">Sin calificar</span>
                    )}
                  </div>
                </article>
              ))}
            </div>

            <button className="button button-primary" disabled={data.closed || saving} type="submit">
              <Save size={17} aria-hidden="true" />
              {saving ? "Guardando..." : "Guardar predicciones"}
            </button>
          </form>
        ) : null}
      </section>
    </main>
  );
}
