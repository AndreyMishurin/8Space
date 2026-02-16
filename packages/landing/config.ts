import { ConfigProps } from "./types/config";

// DaisyUI v5 no longer exports themes directly, using fallback color
const themes = {
  light: {
    primary: "#3b82f6", // blue-500
  }
};

const config = {
  // REQUIRED
  appName: "8Space",
  // REQUIRED: a short description of your app for SEO tags (can be overwritten)
  appDescription:
    "8Space — collaborative team planner with Gantt charts, kanban boards, and backlog management.",
  // REQUIRED (no https://, not trailing slash at the end, just the naked domain)
  domainName: "8space.app",
  crisp: {
    // Crisp website ID. IF YOU DON'T USE CRISP: just remove this => Then add a support email in this config file (resend.supportEmail) otherwise customer support won't work.
    id: "",
    // Hide Crisp by default, except on route "/". Crisp is toggled with <ButtonSupport/>. If you want to show Crisp on every routes, just remove this below
    onlyShowOnRoutes: ["/"],
  },
  stripe: {
    // Create multiple plans in your Stripe dashboard, then add them here. You can add as many plans as you want, just make sure to add the priceId
    plans: [
      {
        // REQUIRED — we use this to find the plan in the webhook (for instance if you want to update the user's credits based on the plan)
        priceId:
          process.env.NODE_ENV === "development"
            ? "price_1Niyy5AxyNprDp7iZIqEyD2h"
            : "price_456",
        //  REQUIRED - Name of the plan, displayed on the pricing page
        name: "Starter",
        // A friendly description of the plan, displayed on the pricing page. Tip: explain why this plan and not others
        description: "Perfect for small projects",
        // The price you want to display, the one user will be charged on Stripe.
        price: 99,
        // If you have an anchor price (i.e. $29) that you want to display crossed out, put it here. Otherwise, leave it empty
        priceAnchor: 149,
        features: [
          {
            name: "Gantt charts",
          },
          { name: "Kanban boards" },
          { name: "Backlog management" },
          { name: "Google OAuth" },
        ],
      },
      {
        priceId:
          process.env.NODE_ENV === "development"
            ? "price_1O5KtcAxyNprDp7iftKnrrpw"
            : "price_456",
        // This plan will look different on the pricing page, it will be highlighted. You can only have one plan with isFeatured: true
        isFeatured: true,
        name: "Advanced",
        description: "For growing teams",
        price: 149,
        priceAnchor: 299,
        features: [
          {
            name: "Gantt charts",
          },
          { name: "Kanban boards" },
          { name: "Backlog management" },
          { name: "Google OAuth" },
          { name: "Priority support" },
          { name: "Unlimited projects" },
        ],
      },
    ],
  },
  aws: {
    // If you use AWS S3/Cloudfront, put values in here
    bucket: "bucket-name",
    bucketUrl: `https://bucket-name.s3.amazonaws.com/`,
    cdn: "https://cdn-id.cloudfront.net/",
  },
  resend: {
    // REQUIRED — Email 'From' field to be used when sending magic login links
    fromNoReply: `8Space <noreply@8space.app>`,
    // REQUIRED — Email 'From' field to be used when sending other emails
    fromAdmin: `8Space Team <hello@8space.app>`,
    // Email shown to customer if they need support
    supportEmail: "support@8space.app",
  },
  colors: {
    // REQUIRED — The DaisyUI theme to use (added to the main layout.js). Leave blank for default (light & dark mode). If you use any theme other than light/dark, you need to add it in config.tailwind.js in daisyui.themes.
    theme: "light",
    // REQUIRED — This color will be reflected on the whole app outside of the document (loading bar, Chrome tabs, etc..). By default it takes the primary color from your DaisyUI theme (make sure to update your the theme name after "data-theme=")
    // OR you can just do this to use a custom color: main: "#f37055". HEX only.
    main: themes["light"]["primary"],
  },
  auth: {
    // REQUIRED — the path to log in users
    loginUrl: "/",
    // REQUIRED — the path you want to redirect users to after a successful login
    callbackUrl: "/app",
  },
} as ConfigProps;

export default config;
