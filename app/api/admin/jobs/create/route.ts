import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import {
  buildBinsSummary,
  deriveAccountId,
  deriveClientName,
  getJobGenerationDayInfo,
  matchesDay,
  parseLatLng,
  type JobSourceClientRow,
} from "@/lib/jobGeneration";

type CreateJobsPayload = {
  propertyId?: string;
};

type NewJobRow = {
  account_id: string;
  property_id: string | null;
  address: string;
  lat: number | null;
  lng: number | null;
  job_type: "put_out" | "bring_in";
  bins: string | null;
  notes: string | null;
  client_name: string | null;
  photo_path: string | null;
  assigned_to: string | null;
  day_of_week: string;
  last_completed_on: null;
};

export async function POST(request: Request) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({
      cookies: () => cookieStore,
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profile")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError || profile?.role !== "admin") {
      return NextResponse.json({ message: "Forbidden." }, { status: 403 });
    }

    let payload: CreateJobsPayload;
    try {
      payload = (await request.json()) as CreateJobsPayload;
    } catch {
      return NextResponse.json({ message: "Invalid request payload." }, { status: 400 });
    }

    const propertyId = payload.propertyId?.trim();
    if (!propertyId) {
      return NextResponse.json({ message: "Property ID is required." }, { status: 400 });
    }

    const { data: client, error: clientError } = await supabase
      .from("client_list")
      .select(
        "property_id, account_id, client_name, company, address, collection_day, put_bins_out, notes, assigned_to, lat_lng, photo_path, red_freq, red_flip, yellow_freq, yellow_flip, green_freq, green_flip",
      )
      .eq("property_id", propertyId)
      .maybeSingle<JobSourceClientRow>();

    if (clientError) {
      console.error("Failed to load client for job creation", clientError);
      return NextResponse.json({ message: "Unable to load property details." }, { status: 500 });
    }

    if (!client) {
      return NextResponse.json({ message: "Property not found." }, { status: 404 });
    }

    const { dayIndex, dayName } = getJobGenerationDayInfo();
    const accountId = deriveAccountId(client);
    const clientName = deriveClientName(client);
    const { lat, lng } = parseLatLng(client.lat_lng);
    const bins = buildBinsSummary(client);
    const address = client.address?.trim() ?? "";

    const jobs: NewJobRow[] = [];

    if (matchesDay(client.put_bins_out, dayIndex)) {
      jobs.push({
        account_id: accountId,
        property_id: client.property_id,
        address,
        lat,
        lng,
        job_type: "put_out",
        bins,
        notes: client.notes,
        client_name: clientName,
        photo_path: client.photo_path,
        assigned_to: client.assigned_to,
        day_of_week: dayName,
        last_completed_on: null,
      });
    }

    if (matchesDay(client.collection_day, dayIndex)) {
      jobs.push({
        account_id: accountId,
        property_id: client.property_id,
        address,
        lat,
        lng,
        job_type: "bring_in",
        bins,
        notes: client.notes,
        client_name: clientName,
        photo_path: client.photo_path,
        assigned_to: client.assigned_to,
        day_of_week: dayName,
        last_completed_on: null,
      });
    }

    if (!jobs.length) {
      return NextResponse.json({
        status: "success",
        message: `No jobs scheduled for ${dayName} for this property.`,
      });
    }

    const { error: deleteError } = await supabase
      .from("jobs")
      .delete()
      .eq("property_id", propertyId)
      .eq("day_of_week", dayName)
      .is("last_completed_on", null);

    if (deleteError) {
      console.error("Failed to clear existing jobs for property", deleteError);
      return NextResponse.json({ message: "Failed to clear existing jobs." }, { status: 500 });
    }

    const { error: insertError } = await supabase.from("jobs").insert(jobs);

    if (insertError) {
      console.error("Failed to create jobs for property", insertError);
      return NextResponse.json({ message: "Failed to create jobs." }, { status: 500 });
    }

    return NextResponse.json({
      status: "success",
      message: `Created ${jobs.length} job${jobs.length === 1 ? "" : "s"} for ${dayName}.`,
    });
  } catch (error) {
    console.error("Unexpected error creating jobs for property", error);
    return NextResponse.json({ message: "Unable to create jobs for this property." }, { status: 500 });
  }
}
