import Link from "next/link";
import { Shield, Trophy, UserRoundCheck } from "lucide-react";

export function AppHeader() {
  return (
    <header className="topbar">
      <Link className="brand" href="/">
        <span className="brand-mark">
          <Trophy size={20} aria-hidden="true" />
        </span>
        <span>
          <span className="brand-title">Quiniela Mundial 2026</span>
          <span className="brand-subtitle">Fase de grupos</span>
        </span>
      </Link>

      <nav className="nav-actions" aria-label="Navegacion principal">
        <Link className="button button-secondary" href="/ranking">
          <Trophy size={17} aria-hidden="true" />
          Ranking
        </Link>
        <Link className="button button-secondary" href="/predicciones">
          <UserRoundCheck size={17} aria-hidden="true" />
          Mis predicciones
        </Link>
        <Link className="button button-secondary" href="/admin">
          <Shield size={17} aria-hidden="true" />
          Admin
        </Link>
      </nav>
    </header>
  );
}
