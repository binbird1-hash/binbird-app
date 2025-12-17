import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

const SIX_WEEKS_IN_MS = 6 * 7 * 24 * 60 * 60 * 1000;

export async function POST() {
  try {
    const supabase = await supabaseServer();
    const cutoff = new Date(Date.now() - SIX_WEEKS_IN_MS).toISOString();

    const { error } = await supabase.from("logs").delete().lt("created_at", cutoff);

    if (error) {
      console.error("Failed to delete old logs", error);
      return NextResponse.json({ error: "Unable to delete old logs." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unexpected error deleting old logs", error);
    return NextResponse.json({ error: "Unable to delete old logs." }, { status: 500 });
  }
}
