import { NextResponse } from "next/server";
import { formatMexicoDateTime } from "@/lib/constants";
import { isAdminSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "Administrador requerido." }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("partidos")
    .select("id,grupo,equipo_local,equipo_visitante,fecha_hora,sede,goles_local_real,goles_visitante_real,estatus")
    .order("fecha_hora", { ascending: true })
    .order("grupo", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "No se pudieron cargar partidos." }, { status: 500 });
  }

  return NextResponse.json({
    matches: (data ?? []).map((match) => ({
      ...match,
      fecha_hora_mx: formatMexicoDateTime(match.fecha_hora)
    }))
  });
}
