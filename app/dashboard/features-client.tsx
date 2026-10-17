"use client";

import { useEffect, useState } from "react";
import { AiCoachChat } from "@/components/AiCoachChat";
import { HabitTracker } from "@/components/HabitTracker";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

interface ActiveGoal {
  title: string;
  summary?: string;
}

/**
 * Client-side wrapper that loads the current user's active goals,
 * then renders both the HabitTracker and the AiCoachChat with goal context.
 */
export function DashboardFeatures() {
  const [goals, setGoals] = useState<ActiveGoal[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isSupabaseConfigured()) return;
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user || cancelled) return;

      const { data } = await sb
        .from("goals")
        .select("title, plan_summary")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(10);

      if (!cancelled && data) {
        setGoals(
          (data as { title: string; plan_summary: string | null }[]).map((g) => ({
            title: g.title,
            summary: g.plan_summary ?? undefined,
          })),
        );
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <div className="dashboard-shell">
        <div className="dashboard-grid" style={{ marginTop: 18 }}>
          <HabitTracker />
        </div>
      </div>
      <AiCoachChat activeGoals={goals} />
    </>
  );
}
