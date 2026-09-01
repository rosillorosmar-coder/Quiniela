import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { RankingRow } from "@/lib/types";

export const dynamic = "force-dynamic";

type UserRow = {
  id: string;
  nombre: string;
  area: string;
};

type PredictionRow = {
  id_usuario: string;
  puntos: number | null;
};

export async function GET() {
  const supabase = getSupabaseAdmin();
  const [{ data: users, error: userError }, { data: predictions, error: predictionError }] =
    await Promise.all([
      supabase.from("usuarios").select("id,nombre,area").eq("activo", true),
      supabase.from("predicciones").select("id_usuario,puntos")
    ]);

  if (userError || predictionError) {
    return NextResponse.json({ error: "No se pudo cargar el ranking." }, { status: 500 });
  }

  const userMap = new Map((users ?? []).map((user: UserRow) => [user.id, user]));
  const rankingMap = new Map<string, RankingRow>();

  for (const prediction of (predictions ?? []) as PredictionRow[]) {
    const user = userMap.get(prediction.id_usuario);
    if (!user) continue;

    const row =
      rankingMap.get(user.id) ??
      {
        id_usuario: user.id,
        nombre: user.nombre,
        area: user.area,
        predicciones_capturadas: 0,
        puntos_totales: 0,
        marcadores_exactos: 0,
        resultados_acertados: 0,
        partidos_sin_puntos: 0
      };

    row.predicciones_capturadas += 1;
    row.puntos_totales += prediction.puntos ?? 0;
    if (prediction.puntos === 6) row.marcadores_exactos += 1;
    if (prediction.puntos === 3) row.resultados_acertados += 1;
    if (prediction.puntos === 0) row.partidos_sin_puntos += 1;
    rankingMap.set(user.id, row);
  }

  const ranking = [...rankingMap.values()].sort(
    (a, b) =>
      b.puntos_totales - a.puntos_totales ||
      b.marcadores_exactos - a.marcadores_exactos ||
      a.nombre.localeCompare(b.nombre)
  );

  return NextResponse.json(
    { ranking },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
