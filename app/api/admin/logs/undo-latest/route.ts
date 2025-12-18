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

    const latestResult = await supabase
      .from("logs")
      .select("id")
      .gte("created_at", todayIso)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestResult.error) {
      console.error("Failed to find today logs for undo", latestResult.error);
      return NextResponse.json({ error: "Unable to find a change to undo." }, { status: 500 });
    }

    if (!latestResult.data) {
      return NextResponse.json({ removed: false, message: "No changes recorded today to undo." });
    }

    const latestId = latestResult.data.id;
    const { error: deleteError } = await supabase.from("logs").delete().eq("id", latestId);

    if (deleteError) {
      console.error("Failed to undo today log", deleteError);
      return NextResponse.json({ error: "Unable to undo the latest change." }, { status: 500 });
    }

    return NextResponse.json({ removed: true, removedId: latestId });
  } catch (error) {
    console.error("Unexpected error undoing today log", error);
    return NextResponse.json({ error: "Unable to undo the latest change." }, { status: 500 });
  }
}
