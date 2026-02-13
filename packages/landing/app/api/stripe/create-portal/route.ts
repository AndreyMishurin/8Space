import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { createCustomerPortal } from "@/libs/stripe";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    try {
      const body = await req.json();

      if (!body.returnUrl) {
        return NextResponse.json(
          { error: "Return URL is required" },
          { status: 400 }
        );
      }

      // TODO: Look up customerId from your database (e.g., a Supabase 'customers' table)
      // For now, this is a placeholder
      const customerId: string | null = null;

      if (!customerId) {
        return NextResponse.json(
          {
            error:
              "You don't have a billing account yet. Make a purchase first.",
          },
          { status: 400 }
        );
      }

      const stripePortalUrl = await createCustomerPortal({
        customerId,
        returnUrl: body.returnUrl,
      });

      return NextResponse.json({
        url: stripePortalUrl,
      });
    } catch (e: any) {
      console.error(e);
      return NextResponse.json({ error: e?.message }, { status: 500 });
    }
  } else {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
}
