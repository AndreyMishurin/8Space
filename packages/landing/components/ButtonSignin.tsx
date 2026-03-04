/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/libs/supabase/client";
import type { User } from "@supabase/supabase-js";
import config from "@/config";

// A simple button to sign in with Google via Supabase Auth.
// After login, user is redirected to /app (8Space SPA).
// If the user is already logged in, shows their avatar and links to /app.
const ButtonSignin = ({
  text = "Get started",
  extraStyle,
}: {
  text?: string;
  extraStyle?: string;
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getUser = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setUser(user);
      } catch {
        // Supabase not configured yet
      }
      setLoading(false);
    };
    getUser();
  }, []);

  const handleSignIn = async () => {
    const supabase = createClient();
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", config.auth.callbackUrl);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
      },
    });
  };

  if (loading) {
    return (
      <button className={`btn ${extraStyle ?? ""}`} disabled>
        <span className="loading loading-spinner loading-xs"></span>
      </button>
    );
  }

  if (user) {
    return (
      <Link href="/app" className={`btn ${extraStyle ?? ""}`}>
        {user.user_metadata?.avatar_url ? (
          <img
            src={user.user_metadata.avatar_url}
            alt={user.user_metadata?.full_name || "Account"}
            className="w-6 h-6 rounded-full shrink-0"
            referrerPolicy="no-referrer"
            width={24}
            height={24}
          />
        ) : (
          <span className="w-6 h-6 bg-base-300 flex justify-center items-center rounded-full shrink-0">
            {user.email?.charAt(0)?.toUpperCase()}
          </span>
        )}
        {user.user_metadata?.full_name || user.email || "Account"}
      </Link>
    );
  }

  return (
    <button
      className={`btn ${extraStyle ?? ""}`}
      onClick={handleSignIn}
    >
      {text}
    </button>
  );
};

export default ButtonSignin;
