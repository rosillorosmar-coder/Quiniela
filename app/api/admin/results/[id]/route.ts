import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function parseGoal(value: unknown) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 30) return null;
  return parsed;
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "Administrador requerido." }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const golesLocal = parseGoal(body?.goles_local_real);
  const golesVisitante = parseGoal(body?.goles_visitante_real);

  if (golesLocal === null || golesVisitante === null) {
    return NextResponse.json({ error: "Captura marcadores enteros entre 0 y 30." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error: updateError } = await supabase
    .from("partidos")
    .update({
      goles_local_real: golesLocal,
      goles_visitante_real: golesVisitante,
      estatus: "finalizado"
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: "No se pudo guardar el resultado." }, { status: 500 });
  }

  const { error: scoreError } = await supabase.rpc("recalcular_puntos_partido", {
    p_id_partido: id
  });

  if (scoreError) {
    return NextResponse.json(
      { error: "Resultado guardado, pero fallo el recalculo de puntos." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
