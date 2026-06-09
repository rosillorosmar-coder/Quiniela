export type MatchStatus = "programado" | "en_juego" | "finalizado";

export type MatchWithPrediction = {
  id: string;
  grupo: string;
  equipo_local: string;
  equipo_visitante: string;
  fecha_hora: string;
  sede?: string | null;
  goles_local_real: number | null;
  goles_visitante_real: number | null;
  estatus: MatchStatus;
  prediction: {
    goles_local_pred: number | null;
    goles_visitante_pred: number | null;
    puntos: number | null;
  } | null;
};

export type RankingRow = {
  id_usuario: string;
  nombre: string;
  area: string;
  predicciones_capturadas: number;
  puntos_totales: number;
  marcadores_exactos: number;
  resultados_acertados: number;
  partidos_sin_puntos: number;
};
