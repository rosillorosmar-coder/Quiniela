import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("ranking")
    .select("id_usuario,nombre,area,predicciones_capturadas,puntos_totales,marcadores_exactos,resultados_acertados,partidos_sin_puntos")
    .order("puntos_totales", { ascending: false })
    .order("marcadores_exactos", { ascending: false })
    .order("nombre", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "No se pudo cargar el ranking." }, { status: 500 });
  }

  return NextResponse.json({ ranking: data ?? [] });
}
