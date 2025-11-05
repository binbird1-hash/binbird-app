import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable.");
}

if (!serviceRoleKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable.");
}

if (!siteUrl) {
  throw new Error("Missing NEXT_PUBLIC_SITE_URL environment variable.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

export async function POST(request: Request) {
  try {
    const { email } = (await request.json()) as { email?: string };

    if (!email) {
      return NextResponse.json(
        { error: "Email is required." },
        { status: 400 },
      );
    }

    const { error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: `${siteUrl}/auth/reset/confirm`,
      },
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status ?? 400 },
      );
    }

    return NextResponse.json({ message: "Reset link sent." });
  } catch (unknownError) {
    const message =
      unknownError instanceof Error
        ? unknownError.message
        : "Unexpected error occurred.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
