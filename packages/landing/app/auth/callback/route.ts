import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/app";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Successful auth — redirect to the Oko app
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth error — redirect to landing with error message
  return NextResponse.redirect(`${origin}/?error=auth_callback_error`);
}
