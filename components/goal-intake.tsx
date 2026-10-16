"use client";

import { FormEvent, useState } from "react";
import { ArrowRightIcon, SparkleIcon } from "@/components/planner-icons";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export function GoalIntake({ onNeedsAuth }: { onNeedsAuth: () => void }) {
  const [goal, setGoal] = useState("");
  const [experience, setExperience] = useState("beginner");
  const [minutes, setMinutes] = useState(45);
  const [daysPerWeek, setDaysPerWeek] = useState(5);
  const [deadline, setDeadline] = useState("");
  const [progress, setProgress] = useState(0);
  const [difficulty, setDifficulty] = useState("moderate");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (!isSupabaseConfigured()) { setError("Supabase is not connected yet. Add the project URL and publishable key in .env.local, then try again."); return; }
    const { data } = await createClient().auth.getUser();
    if (!data.user) { setError("Create an account or sign in first—your plan will be private and saved."); onNeedsAuth(); return; }
    setLoading(true);
    const response = await fetch("/api/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goal, experienceLevel: experience, minutesPerDay: minutes, daysPerWeek, desiredDeadline: deadline || undefined, currentProgressPercent: progress, currentProgressNote: notes || undefined, difficulty }) });
    const payload = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) return setError(payload.error ?? "We couldn’t create that plan yet.");
    window.location.assign(`/dashboard?goal=${payload.goalId}`);
  }

  return <form className="intake-card" onSubmit={submit}>
    <div className="intake-heading"><span className="icon-bubble"><SparkleIcon size={18} /></span><div><p className="eyebrow">Your next chapter</p><h2>What do you want to make happen?</h2></div></div>
    <label className="goal-field"><span>Describe your goal</span><textarea required minLength={3} maxLength={1200} value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="e.g. Learn Python well enough to automate my weekly reporting" rows={3} /></label>
    <div className="form-grid">
      <label>Starting point<select value={experience} onChange={(event) => setExperience(event.target.value)}><option value="beginner">New to this</option><option value="some_experience">Some experience</option><option value="intermediate">Comfortable</option><option value="advanced">Advanced</option></select></label>
      <label>Time per day<select value={minutes} onChange={(event) => setMinutes(Number(event.target.value))}><option value={20}>20 minutes</option><option value={30}>30 minutes</option><option value={45}>45 minutes</option><option value={60}>1 hour</option><option value={90}>90 minutes</option><option value={120}>2 hours</option></select></label>
      <label>Days each week<select value={daysPerWeek} onChange={(event) => setDaysPerWeek(Number(event.target.value))}>{[3, 4, 5, 6, 7].map((day) => <option key={day} value={day}>{day} days</option>)}</select></label>
      <label>Preferred pace<select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="easy">Gentle</option><option value="moderate">Balanced</option><option value="challenging">Ambitious</option></select></label>
      <label>Deadline <input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label>
      <label>Already complete <select value={progress} onChange={(event) => setProgress(Number(event.target.value))}>{[0, 10, 25, 50, 75].map((value) => <option key={value} value={value}>{value}%</option>)}</select></label>
    </div>
    <label>Anything Pace should know? <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Schedule constraints, what you’ve tried, resources you have…" maxLength={500} /></label>
    <div className="intake-footer"><p>Built around your actual time, not wishful thinking.</p><button className="button button-accent" disabled={loading} type="submit">{loading ? "Building your plan…" : <>Generate my plan <ArrowRightIcon size={18} /></>}</button></div>
    {error && <p className="form-message error" role="alert">{error}</p>}
  </form>;
}
