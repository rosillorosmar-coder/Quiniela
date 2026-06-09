"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { normalizeCurp } from "@/lib/constants";

export default function HomePage() {
  const router = useRouter();
  const [curp, setCurp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const response = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ curp: normalizeCurp(curp) })
    });

    const payload = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(payload.error ?? "No se pudo iniciar sesion.");
      return;
    }

    router.push("/predicciones");
  }

  return (
    <main className="app-shell">
      <AppHeader />
      <section className="page center-page">
        <div className="login-grid">
          <div className="intro-panel">
            <h1>Quiniela Mundial 2026</h1>
            <p>
              Ingresa con tu CURP, captura todos tus marcadores de fase de grupos y consulta el
              ranking publico cuando empiecen a caer los resultados.
            </p>
          </div>

          <form className="auth-card" onSubmit={submit}>
            <KeyRound size={30} color="var(--primary)" aria-hidden="true" />
            <h2>Identificacion</h2>
            <p className="muted">
              Solo participantes precargados y activos pueden registrar predicciones.
            </p>

            <div className="field">
              <label htmlFor="curp">CURP</label>
              <input
                className="input"
                id="curp"
                maxLength={18}
                minLength={10}
                onChange={(event) => setCurp(event.target.value)}
                placeholder="Ingresa tu CURP"
                required
                value={curp}
              />
            </div>

            {error ? <p className="error">{error}</p> : null}

            <button className="button button-primary" disabled={loading} type="submit">
              {loading ? "Validando..." : "Entrar"}
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
