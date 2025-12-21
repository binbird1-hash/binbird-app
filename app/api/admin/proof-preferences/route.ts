import { NextResponse } from "next/server";
import { normalizeProofPreference, type ProofPhotoPreference } from "@/lib/proof-photos";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<ProofPhotoPreference>;
    const preference = normalizeProofPreference(body);

    if (!preference?.property_id) {
      return NextResponse.json({ error: "A property ID is required." }, { status: 400 });
    }

    const supabase = await supabaseServer();

    const { data, error } = await supabase
      .from("proof_photo_preferences")
      .upsert(
        {
          property_id: preference.property_id,
          job_type: preference.job_type,
          parity: preference.parity,
          photo_path: preference.photo_path,
        },
        {
          onConflict: "property_id,job_type,parity",
        },
      )
      .select("id, property_id, job_type, parity, photo_path, created_at")
      .maybeSingle();

    if (error) {
      console.error("Failed to save proof preference", error);
      return NextResponse.json({ error: "Unable to save proof preference" }, { status: 500 });
    }

    const normalized = data ? normalizeProofPreference(data) : null;

    if (!normalized) {
      console.error("Failed to normalize proof preference", data);
      return NextResponse.json({ error: "Unable to save proof preference" }, { status: 500 });
    }

    return NextResponse.json({ preference: normalized }, { status: 200 });
  } catch (error) {
    console.error("Unexpected error saving proof preference", error);
    return NextResponse.json({ error: "Unable to save proof preference" }, { status: 500 });
  }
}
