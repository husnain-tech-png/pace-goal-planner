"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, FlameIcon, ClockIcon } from "@/components/planner-icons";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

// ── Types ───────────────────────────────────────────────────────────
interface Habit {
  id: string;
  title: string;
  completed: boolean;
  minutesSpent: number;
  dbId?: string; // Supabase row id
}

// ── Helpers ─────────────────────────────────────────────────────────
const todayISO = () => new Date().toISOString().slice(0, 10);

const DEFAULT_HABITS: Omit<Habit, "id">[] = [
  { title: "Morning review — check today's tasks", completed: false, minutesSpent: 0 },
  { title: "Deep work block (25 min)", completed: false, minutesSpent: 0 },
  { title: "Review progress & plan tomorrow", completed: false, minutesSpent: 0 },
];

function uid() {
  return `h-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Pomodoro Timer ──────────────────────────────────────────────────
const POMODORO_SECONDS = 25 * 60;

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// ── Component ───────────────────────────────────────────────────────
export function HabitTracker() {
  // ── State ───────────────────────────────────────────────────────
  const [habits, setHabits] = useState<Habit[]>(() =>
    DEFAULT_HABITS.map((h) => ({ ...h, id: uid() })),
  );
  const [newTitle, setNewTitle] = useState("");
  const [streak, setStreak] = useState(0);
  const [timerLeft, setTimerLeft] = useState(POMODORO_SECONDS);
  const [timerRunning, setTimerRunning] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Derived ─────────────────────────────────────────────────────
  const completedCount = useMemo(() => habits.filter((h) => h.completed).length, [habits]);
  const totalCount = habits.length;
  const percent = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

  // ── Supabase sync: load today's logs ────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isSupabaseConfigured()) { setLoaded(true); return; }
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { setLoaded(true); return; }

      // Fetch today's logs
      const { data: logs } = await sb
        .from("daily_logs")
        .select("*")
        .eq("user_id", user.id)
        .eq("log_date", todayISO());

      if (!cancelled && logs && logs.length > 0) {
        setHabits(
          logs.map((log: Record<string, unknown>) => ({
            id: uid(),
            dbId: log.id as string,
            title: log.title as string,
            completed: log.completed as boolean,
            minutesSpent: (log.minutes_spent as number) ?? 0,
          })),
        );
      }

      // Calculate streak
      if (!cancelled) {
        await calcStreak(sb, user.id);
      }
      if (!cancelled) setLoaded(true);
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  async function calcStreak(sb: ReturnType<typeof createClient>, userId: string) {
    // Get the last 60 days of logs, grouped by date
    const { data: rows } = await sb
      .from("daily_logs")
      .select("log_date, completed")
      .eq("user_id", userId)
      .order("log_date", { ascending: false })
      .limit(600);

    if (!rows || rows.length === 0) { setStreak(0); return; }

    // Group by date
    const dateMap = new Map<string, { total: number; done: number }>();
    for (const row of rows) {
      const d = row.log_date as string;
      const entry = dateMap.get(d) ?? { total: 0, done: 0 };
      entry.total++;
      if (row.completed) entry.done++;
      dateMap.set(d, entry);
    }

    // Count consecutive days where all habits completed (starting from today or yesterday)
    let s = 0;
    const cursor = new Date();
    // Check if today is complete — if not, start from yesterday
    const todayEntry = dateMap.get(todayISO());
    if (!todayEntry || todayEntry.done < todayEntry.total) {
      cursor.setDate(cursor.getDate() - 1);
    }
    for (let i = 0; i < 60; i++) {
      const key = cursor.toISOString().slice(0, 10);
      const entry = dateMap.get(key);
      if (entry && entry.total > 0 && entry.done >= entry.total) {
        s++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    setStreak(s);
  }

  // ── Upsert to Supabase ──────────────────────────────────────────
  const upsertLog = useCallback(async (habit: Habit) => {
    if (!isSupabaseConfigured()) return;
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;

    const payload = {
      user_id: user.id,
      title: habit.title,
      log_date: todayISO(),
      completed: habit.completed,
      minutes_spent: habit.minutesSpent,
    };

    if (habit.dbId) {
      await sb.from("daily_logs").update(payload).eq("id", habit.dbId);
    } else {
      const { data } = await sb
        .from("daily_logs")
        .upsert(payload, { onConflict: "user_id,title,log_date" })
        .select("id")
        .single();
      if (data) {
        setHabits((prev) =>
          prev.map((h) =>
            h.id === habit.id ? { ...h, dbId: (data as { id: string }).id } : h,
          ),
        );
      }
    }

    // Recalculate streak after toggle
    void calcStreak(sb, user.id);
  }, []);

  // ── Toggle habit ────────────────────────────────────────────────
  const toggleHabit = useCallback(
    (id: string) => {
      setHabits((prev) => {
        const next = prev.map((h) =>
          h.id === id ? { ...h, completed: !h.completed } : h,
        );
        const toggled = next.find((h) => h.id === id);
        if (toggled) void upsertLog(toggled);
        return next;
      });
    },
    [upsertLog],
  );

  // ── Add habit ───────────────────────────────────────────────────
  const addHabit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const title = newTitle.trim();
      if (!title) return;
      const habit: Habit = { id: uid(), title, completed: false, minutesSpent: 0 };
      setHabits((prev) => [...prev, habit]);
      setNewTitle("");
      void upsertLog(habit);
    },
    [newTitle, upsertLog],
  );

  // ── Timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (timerRunning && timerLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimerLeft((prev) => {
          if (prev <= 1) {
            setTimerRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning, timerLeft]);

  const timerPercent = ((POMODORO_SECONDS - timerLeft) / POMODORO_SECONDS) * 100;

  return (
    <section className="habit-tracker-card" id="habit-tracker">
      {/* Header */}
      <div className="habit-tracker-header">
        <div>
          <p className="eyebrow">Daily Activity</p>
          <h2>Today's Habits & Focus</h2>
        </div>
        <div className="habit-streak-badge" title={`${streak} day streak`}>
          <FlameIcon size={16} />
          <strong>{streak} day{streak !== 1 ? "s" : ""}</strong>
        </div>
      </div>

      {/* Progress bar */}
      <div className="habit-progress-row">
        <div className="habit-progress-track">
          <span
            className="habit-progress-fill"
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="habit-progress-label">{percent}% done</span>
      </div>

      {/* Habit list */}
      <div className="habit-list">
        {habits.map((habit) => (
          <div
            key={habit.id}
            className={`habit-row ${habit.completed ? "habit-done" : ""}`}
          >
            <button
              className="habit-check"
              onClick={() => toggleHabit(habit.id)}
              aria-label={habit.completed ? `Undo ${habit.title}` : `Complete ${habit.title}`}
            >
              {habit.completed && <CheckIcon size={14} />}
            </button>
            <span className="habit-label">{habit.title}</span>
          </div>
        ))}
      </div>

      {/* Add new habit */}
      <form className="habit-add-form" onSubmit={addHabit}>
        <input
          className="habit-add-input"
          placeholder="Add a daily habit…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          maxLength={300}
          id="habit-add-input"
        />
        <button
          className="habit-add-btn"
          type="submit"
          disabled={!newTitle.trim()}
          id="habit-add-btn"
        >
          +
        </button>
      </form>

      {/* Pomodoro timer */}
      <div className="pomodoro-section">
        <div className="pomodoro-header">
          <ClockIcon size={16} />
          <strong>Focus Timer</strong>
          <small>25 min Pomodoro</small>
        </div>

        <div className="pomodoro-ring-wrapper">
          <svg className="pomodoro-ring" viewBox="0 0 120 120">
            <circle className="pomodoro-ring-bg" cx="60" cy="60" r="52" />
            <circle
              className="pomodoro-ring-fill"
              cx="60"
              cy="60"
              r="52"
              strokeDasharray={`${2 * Math.PI * 52}`}
              strokeDashoffset={`${2 * Math.PI * 52 * (1 - timerPercent / 100)}`}
            />
          </svg>
          <span className="pomodoro-time">{formatTime(timerLeft)}</span>
        </div>

        <div className="pomodoro-controls">
          <button
            className="pomodoro-btn pomodoro-start"
            onClick={() => setTimerRunning((r) => !r)}
            id="pomodoro-start"
          >
            {timerRunning ? "Pause" : timerLeft < POMODORO_SECONDS ? "Resume" : "Start"}
          </button>
          <button
            className="pomodoro-btn pomodoro-reset"
            onClick={() => {
              setTimerRunning(false);
              setTimerLeft(POMODORO_SECONDS);
            }}
            id="pomodoro-reset"
          >
            Reset
          </button>
        </div>
      </div>
    </section>
  );
}
