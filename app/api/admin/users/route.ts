import { NextResponse } from "next/server";
import { normalizeCurp } from "@/lib/constants";
import { isAdminSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function normalizeText(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export async function POST(request: Request) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "Administrador requerido." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const nombre = normalizeText(body?.nombre).toUpperCase();
  const curp = normalizeCurp(String(body?.curp ?? ""));
  const area = normalizeText(body?.area).toUpperCase() || "SIN AREA";
  const activo = body?.activo !== false;

  if (!nombre) {
    return NextResponse.json({ error: "Captura el nombre del usuario." }, { status: 400 });
  }

  if (curp.length !== 18) {
    return NextResponse.json({ error: "La CURP debe tener 18 caracteres." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: existing, error: lookupError } = await supabase
    .from("usuarios")
    .select("id")
    .eq("curp", curp)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: "No se pudo validar la CURP." }, { status: 500 });
  }

  if (existing) {
    return NextResponse.json({ error: "Ya existe un usuario registrado con esa CURP." }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("usuarios")
    .insert({ nombre, curp, area, activo })
    .select("id,nombre,area")
    .single();

  if (error) {
    return NextResponse.json({ error: "No se pudo crear el usuario." }, { status: 500 });
  }

  const { count } = await supabase
    .from("usuarios")
    .select("id", { count: "exact", head: true });

  return NextResponse.json({ user: data, totalUsuarios: count ?? null }, { status: 201 });
}
