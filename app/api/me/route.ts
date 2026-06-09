import { NextResponse } from "next/server";
import { maskCurp } from "@/lib/constants";
import { getUserIdFromSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const userId = await getUserIdFromSession();

  if (!userId) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("usuarios")
    .select("id,nombre,curp,area,activo")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data || !data.activo) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: data.id,
      nombre: data.nombre,
      area: data.area,
      curp_mascarada: maskCurp(data.curp)
    }
  });
}
