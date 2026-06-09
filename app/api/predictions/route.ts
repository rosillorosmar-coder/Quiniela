import { NextResponse } from "next/server";
import { CAPTURE_DEADLINE_LABEL, formatMexicoDateTime, isCaptureClosed } from "@/lib/constants";
import { getUserIdFromSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type PredictionInput = {
  id_partido: string;
  goles_local_pred: number;
  goles_visitante_pred: number;
};

function isValidGoal(value: unknown) {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 30;
}

export async function GET() {
  const userId = await getUserIdFromSession();

  if (!userId) {
    return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const [{ data: user }, { data: matches, error: matchError }, { data: predictions }] =
    await Promise.all([
      supabase.from("usuarios").select("id,nombre,area,activo").eq("id", userId).maybeSingle(),
      supabase
        .from("partidos")
        .select("id,grupo,equipo_local,equipo_visitante,fecha_hora,sede,goles_local_real,goles_visitante_real,estatus")
        .order("fecha_hora", { ascending: true })
        .order("grupo", { ascending: true }),
      supabase
        .from("predicciones")
        .select("id_partido,goles_local_pred,goles_visitante_pred,puntos")
        .eq("id_usuario", userId)
    ]);

  if (!user?.activo) {
    return NextResponse.json({ error: "Participante inactivo." }, { status: 403 });
  }

  if (matchError) {
    return NextResponse.json({ error: "No se pudieron cargar los partidos." }, { status: 500 });
  }

  const predictionMap = new Map((predictions ?? []).map((prediction) => [prediction.id_partido, prediction]));

  return NextResponse.json({
    closed: isCaptureClosed(),
    deadlineLabel: CAPTURE_DEADLINE_LABEL,
    user,
    matches: (matches ?? []).map((match) => ({
      ...match,
      fecha_hora_mx: formatMexicoDateTime(match.fecha_hora),
      prediction: predictionMap.get(match.id) ?? null
    }))
  });
}

export async function PUT(request: Request) {
  const userId = await getUserIdFromSession();

  if (!userId) {
    return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });
  }

  if (isCaptureClosed()) {
    return NextResponse.json(
      { error: `La captura cerro el ${CAPTURE_DEADLINE_LABEL} hora de Mexico.` },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const predictions = body?.predictions as PredictionInput[] | undefined;

  if (!Array.isArray(predictions)) {
    return NextResponse.json({ error: "Formato de predicciones invalido." }, { status: 400 });
  }

  const seen = new Set<string>();
  const rows = [];

  for (const prediction of predictions) {
    if (!prediction.id_partido || seen.has(prediction.id_partido)) {
      return NextResponse.json({ error: "Hay partidos duplicados o invalidos." }, { status: 400 });
    }

    seen.add(prediction.id_partido);

    if (!isValidGoal(prediction.goles_local_pred) || !isValidGoal(prediction.goles_visitante_pred)) {
      return NextResponse.json(
        { error: "Los marcadores deben ser numeros enteros entre 0 y 30." },
        { status: 400 }
      );
    }

    rows.push({
      id_usuario: userId,
      id_partido: prediction.id_partido,
      goles_local_pred: prediction.goles_local_pred,
      goles_visitante_pred: prediction.goles_visitante_pred
    });
  }

  const supabase = getSupabaseAdmin();
  const { data: user } = await supabase
    .from("usuarios")
    .select("id,activo")
    .eq("id", userId)
    .maybeSingle();

  if (!user?.activo) {
    return NextResponse.json({ error: "Participante inactivo." }, { status: 403 });
  }

  const { error } = await supabase
    .from("predicciones")
    .upsert(rows, { onConflict: "id_usuario,id_partido" });

  if (error) {
    return NextResponse.json({ error: "No se pudieron guardar las predicciones." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
