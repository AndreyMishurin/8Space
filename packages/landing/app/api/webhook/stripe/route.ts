import { NextResponse, NextRequest } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import configFile from "@/config";
import { findCheckoutSession } from "@/libs/stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-08-16",
  typescript: true,
});
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// This is where we receive Stripe webhook events
// It's used to update user data, send emails, etc...
// TODO: Update to use Supabase instead of MongoDB for user storage
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = (await headers()).get("stripe-signature");

  let eventType;
  let event;

  // verify Stripe event is legit
  try {
    event = stripe.webhooks.constructEvent(body, signature!, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed. ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  eventType = event.type;

  try {
    switch (eventType) {
      case "checkout.session.completed": {
        const stripeObject: Stripe.Checkout.Session = event.data
          .object as Stripe.Checkout.Session;

        const session = await findCheckoutSession(stripeObject.id);
        const priceId = session?.line_items?.data[0]?.price?.id;
        const plan = configFile.stripe.plans.find(
          (p) => p.priceId === priceId
        );

        if (!plan) break;

        // TODO: Grant access to the product via Supabase
        // const userId = stripeObject.client_reference_id;
        // Update user in Supabase with hasAccess = true, customerId, priceId, etc.

        break;
      }

      case "checkout.session.expired":
        break;

      case "customer.subscription.updated":
        break;

      case "customer.subscription.deleted": {
        // TODO: Revoke access via Supabase
        break;
      }

      case "invoice.paid": {
        // TODO: Grant access via Supabase
        break;
      }

      case "invoice.payment_failed":
        break;

      default:
      // Unhandled event type
    }
  } catch (e: any) {
    console.error("stripe error: ", e.message);
  }

  return NextResponse.json({});
}
