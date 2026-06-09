"use client";

import { useEffect, useState } from "react";
import { Medal, RefreshCcw } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import type { RankingRow } from "@/lib/types";

export default function RankingPage() {
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    const response = await fetch("/api/ranking", { cache: "no-store" });
    const payload = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(payload.error ?? "No se pudo cargar el ranking.");
      return;
    }

    setRanking(payload.ranking);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="app-shell">
      <AppHeader />
      <section className="page panel">
        <div className="panel-header">
          <div>
            <h1>Ranking publico</h1>
            <p className="muted">Ordenado por puntos totales y desempate por marcadores exactos.</p>
            <p className="counter-pill">
              {ranking.length} {ranking.length === 1 ? "participante" : "participantes"}
            </p>
          </div>
          <button className="button button-secondary" onClick={load} type="button">
            <RefreshCcw size={17} aria-hidden="true" />
            Actualizar
          </button>
        </div>

        {loading ? <p className="notice">Cargando ranking...</p> : null}
        {error ? <p className="error">{error}</p> : null}

        <div className="ranking-table">
          <div className="ranking-row header">
            <span>#</span>
            <span>Participante</span>
            <span className="metric">Puntos</span>
            <span className="metric">Exactos</span>
            <span className="metric">Resultado</span>
            <span className="metric">Sin puntos</span>
          </div>

          {ranking.map((row, index) => (
            <article className="ranking-row" key={row.id_usuario}>
              <span className="rank-number">
                {index === 0 ? <Medal size={20} aria-label="Primer lugar" /> : index + 1}
              </span>
              <span>
                <strong>{row.nombre}</strong>
                <br />
                <span className="muted">{row.area}</span>
              </span>
              <span className="metric">{row.puntos_totales}</span>
              <span className="metric">{row.marcadores_exactos}</span>
              <span className="metric">{row.resultados_acertados}</span>
              <span className="metric">{row.partidos_sin_puntos}</span>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
