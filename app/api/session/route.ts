import { NextResponse } from "next/server";
import { normalizeCurp, maskCurp } from "@/lib/constants";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { clearUserSession, setUserSession } from "@/lib/session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const curp = normalizeCurp(body?.curp ?? "");

  if (!curp || curp.length < 10) {
    return NextResponse.json({ error: "Ingresa una CURP valida." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("usuarios")
    .select("id,nombre,curp,area,activo")
    .eq("curp", curp)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "No se pudo validar la CURP." }, { status: 500 });
  }

  if (!data || !data.activo) {
    return NextResponse.json(
      { error: "La CURP no esta registrada como participante activo." },
      { status: 403 }
    );
  }

  await setUserSession(data.id);

  return NextResponse.json({
    user: {
      id: data.id,
      nombre: data.nombre,
      area: data.area,
      curp_mascarada: maskCurp(data.curp)
    }
  });
}

export async function DELETE() {
  await clearUserSession();
  return NextResponse.json({ ok: true });
}
