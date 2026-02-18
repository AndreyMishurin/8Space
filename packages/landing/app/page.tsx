"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/libs/supabase/client";
import type { User } from "@supabase/supabase-js";
import { BackgroundPaths } from "@/components/ui/background-paths";
import HeaderNav from "@/components/HeaderNav";
import Footer from "@/components/Footer";
import Link from "next/link";

export default function Page() {
  const [user, setUser] = useState<User | null>(null);

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
    };
    getUser();
  }, []);

  const handleGetStarted = () => {
    if (user) {
      window.location.href = "/app";
      return;
    }
    const supabase = createClient();
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const extraRight = user ? (
    <Link
      href="/app"
      className="inline-flex items-center gap-2 px-4 py-2 rounded-full
        bg-white/15 hover:bg-white/25 border border-white/10
        text-white font-medium text-sm transition-colors"
    >
      {user.user_metadata?.avatar_url ? (
        <img
          src={user.user_metadata.avatar_url}
          alt=""
          className="w-5 h-5 rounded-full"
          referrerPolicy="no-referrer"
        />
      ) : null}
      Open App →
    </Link>
  ) : null;

  return (
    <>
      <HeaderNav extraRight={extraRight} />

      <BackgroundPaths
        title="8Space Planner"
        subtitle="Collaborative project management with Gantt charts, kanban boards, and backlog — all in one place."
        ctaText={user ? "Open App" : "Get Started"}
        onCtaClick={handleGetStarted}
      />

      <Footer />
    </>
  );
}
