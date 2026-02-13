import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { createCheckout } from "@/libs/stripe";

// This function is used to create a Stripe Checkout Session (one-time payment or subscription)
// It's called by the <ButtonCheckout /> component
export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body.priceId) {
    return NextResponse.json(
      { error: "Price ID is required" },
      { status: 400 }
    );
  } else if (!body.successUrl || !body.cancelUrl) {
    return NextResponse.json(
      { error: "Success and cancel URLs are required" },
      { status: 400 }
    );
  } else if (!body.mode) {
    return NextResponse.json(
      {
        error:
          "Mode is required (either 'payment' for one-time payments or 'subscription' for recurring subscription)",
      },
      { status: 400 }
    );
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { priceId, mode, successUrl, cancelUrl } = body;

    const stripeSessionURL = await createCheckout({
      priceId,
      mode,
      successUrl,
      cancelUrl,
      clientReferenceId: user?.id,
      user: user
        ? { email: user.email, customerId: null }
        : null,
    });

    return NextResponse.json({ url: stripeSessionURL });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
