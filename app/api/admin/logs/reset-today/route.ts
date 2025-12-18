import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

const startOfTodayIso = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString();
};

export async function POST() {
  try {
    const supabase = await supabaseServer();
    const todayIso = startOfTodayIso();

    const { data, error } = await supabase
      .from("logs")
      .delete()
      .gte("created_at", todayIso)
      .select("id", { count: "exact" });

    if (error) {
      console.error("Failed to reset today logs", error);
      return NextResponse.json({ error: "Unable to reset today changes." }, { status: 500 });
    }

    return NextResponse.json({ removed: data?.length ?? 0 });
  } catch (error) {
    console.error("Unexpected error resetting today logs", error);
    return NextResponse.json({ error: "Unable to reset today changes." }, { status: 500 });
  }
}
