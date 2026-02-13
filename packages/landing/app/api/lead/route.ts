import { NextResponse, NextRequest } from "next/server";

// This route is used to store the leads that are generated from the landing page.
// The API call is initiated by <ButtonLead /> component
export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body.email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  try {
    // TODO: Add your own lead storage logic here
    // For instance, save to Supabase or send a welcome email
    return NextResponse.json({});
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
