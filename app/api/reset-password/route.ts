import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type ResetPasswordRequest = {
  email?: string;
};

export async function POST(request: Request) {
  let body: ResetPasswordRequest;

  try {
    body = (await request.json()) as ResetPasswordRequest;
  } catch (unknownError) {
    const message =
      unknownError instanceof Error
        ? unknownError.message
        : "Invalid request body.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  const email = body.email?.trim();

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (!supabaseUrl || !serviceRoleKey || !siteUrl) {
    console.error(
      "Password reset misconfigured. Ensure NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and NEXT_PUBLIC_SITE_URL are set.",
    );

    return NextResponse.json(
      { error: "Password reset is temporarily unavailable." },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
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
