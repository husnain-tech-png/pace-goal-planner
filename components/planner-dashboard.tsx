"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { CalendarIcon, CheckIcon, ClockIcon, SparkleIcon, TargetIcon, TrendIcon } from "@/components/planner-icons";

type Task = { id: string; title: string; description: string | null; scheduled_for: string | null; estimated_minutes: number | null; priority: "low" | "medium" | "high"; status: "pending" | "completed" | "skipped" | "cancelled" };
type Milestone = { id: string; title: string; description: string | null; due_date: string | null; status: "upcoming" | "active" | "completed" };
type GoalData = { goal: { id: string; title: string; plan_summary: string | null; estimated_days: number | null; planned_start_date: string; expected_completion_date: string | null; status: string }; tasks: Task[]; milestones: Milestone[]; plan: { plan?: { schedule?: { weeklyFocus?: string; minutesPerDay?: number }; recommendations?: string[] } } | null };

function dateLabel(value?: string | null) { return value ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(`${value}T12:00:00`)) : "Flexible"; }

export function PlannerDashboard({ goalId }: { goalId: string }) {
  const [data, setData] = useState<GoalData | null>(null); const [error, setError] = useState(""); const [adjusting, setAdjusting] = useState(false);
  const load = async () => { const response = await fetch(`/api/goals/${goalId}`); const payload = await response.json().catch(() => ({})); if (!response.ok) setError(payload.error ?? "Couldn’t load this goal."); else setData(payload); };
  useEffect(() => { void load(); }, [goalId]);
  const completed = useMemo(() => data?.tasks.filter((task) => task.status === "completed").length ?? 0, [data]);
  const actionable = useMemo(() => data?.tasks.filter((task) => task.status !== "cancelled") ?? [], [data]);
  const percent = actionable.length ? Math.round((completed / actionable.length) * 100) : 0;
  const today = new Date().toISOString().slice(0, 10);
  const remainingDays = data?.goal.expected_completion_date
    ? Math.max(0, Math.ceil((new Date(`${data.goal.expected_completion_date}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86_400_000))
    : data?.goal.estimated_days ?? 0;
  const plannedToDate = actionable.filter((task) => task.scheduled_for && task.scheduled_for <= today).length;
  const plannedPercent = actionable.length ? Math.round((plannedToDate / actionable.length) * 100) : 0;
  const pace = percent - plannedPercent;
  const paceLabel = pace >= 8 ? "Ahead of schedule" : pace <= -8 ? "A little behind" : "On track";
  const todayTasks = actionable.filter((task) => task.status === "pending" && (!task.scheduled_for || task.scheduled_for <= today)).slice(0, 5);

  async function toggleTask(task: Task) {
    const nextStatus = task.status === "completed" ? "pending" : "completed";
    setData((current) => current ? { ...current, tasks: current.tasks.map((item) => item.id === task.id ? { ...item, status: nextStatus } : item) } : current);
    const response = await fetch(`/api/tasks/${task.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: nextStatus }) });
    if (!response.ok) { setError("That update didn’t save. Please try again."); void load(); }
  }
  async function adjustPlan() {
    const reason = window.prompt("What changed? For example: ‘I missed three days’ or ‘I now have 90 minutes a day.’");
    if (!reason?.trim()) return;
    setAdjusting(true); setError("");
    const minutes = window.prompt("Optional: enter your new minutes available per day, or leave blank.");
    const minutesPerDay = minutes?.trim() ? Number(minutes) : undefined;
    const response = await fetch(`/api/goals/${goalId}/adjust`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason, minutesPerDay: Number.isFinite(minutesPerDay) ? minutesPerDay : undefined }) });
    const payload = await response.json().catch(() => ({})); setAdjusting(false);
    if (!response.ok) return setError(payload.error ?? "We couldn’t adjust your plan.");
    await load();
  }

  if (error && !data) return <main className="page-shell dashboard-shell"><a className="wordmark" href="/">pace</a><div className="empty-state"><h1>We hit a snag.</h1><p>{error}</p><a className="button button-dark" href="/">Create a new plan</a></div></main>;
  if (!data) return <main className="page-shell dashboard-shell"><div className="loading-dot">Loading your momentum…</div></main>;
  const recommendations = data.plan?.plan?.recommendations ?? [];
  return <main className="dashboard-shell"><nav className="dash-nav"><a className="wordmark" href="/">pace<span>.</span></a><a href="/" className="quiet-link">New goal</a></nav><div className="dashboard-grid">
    <section className="dash-hero"><p className="eyebrow">Active plan</p><h1>{data.goal.title}</h1><p>{data.goal.plan_summary}</p><div className="hero-meta"><span><CalendarIcon size={16} /> Finish {dateLabel(data.goal.expected_completion_date)}</span><span><ClockIcon size={16} /> {data.plan?.plan?.schedule?.minutesPerDay ?? 45} min focus blocks</span></div></section>
    <section className="progress-card"><div className="progress-top"><div><p className="eyebrow">Overall progress</p><strong>{percent}%</strong></div><div className="ring" style={{ "--progress": `${percent * 3.6}deg` } as CSSProperties}><span>{completed}/{actionable.length}</span></div></div><div className="progress-track"><span style={{ width: `${percent}%` }} /></div><div className="progress-stats"><span className={pace >= 8 ? "positive" : pace <= -8 ? "warning" : ""}>{paceLabel}</span><span>{remainingDays} days left</span></div></section>
    <section className="today-card"><div className="section-heading"><div><p className="eyebrow">Today’s focus</p><h2>One clear win at a time.</h2></div><span className="day-chip">{new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(new Date())}</span></div>{todayTasks.length ? <div className="task-list">{todayTasks.map((task) => <TaskRow key={task.id} task={task} onToggle={toggleTask} />)}</div> : <div className="done-today"><CheckIcon size={20} /><p>Nothing urgent is waiting. Review your plan or enjoy the space.</p></div>}</section>
    <section className="milestone-card"><div className="section-heading"><div><p className="eyebrow">Milestones</p><h2>See the path ahead</h2></div></div><div className="milestone-list">{data.milestones.map((milestone, index) => <div className={`milestone ${milestone.status}`} key={milestone.id}><span>{milestone.status === "completed" ? <CheckIcon size={14} /> : index + 1}</span><div><strong>{milestone.title}</strong><p>{milestone.description}</p></div><time>{dateLabel(milestone.due_date)}</time></div>)}</div></section>
    <section className="insights-card"><div className="insight-icon"><TrendIcon size={20} /></div><div><p className="eyebrow">Plan pulse</p><h2>{data.plan?.plan?.schedule?.weeklyFocus ?? "Keep your plan adaptive"}</h2><p>{recommendations[0] ?? "Your plan changes with real life. Update it as your capacity changes."}</p></div><button className="button button-dark compact" disabled={adjusting} onClick={adjustPlan}>{adjusting ? "Adjusting…" : <> <SparkleIcon size={15} /> Adjust with AI</>}</button></section>
    <section className="all-tasks-card"><div className="section-heading"><div><p className="eyebrow">Plan library</p><h2>Every task, in one place</h2></div><span className="tasks-count"><TargetIcon size={16} /> {actionable.length - completed} remaining</span></div><div className="task-list full">{actionable.map((task) => <TaskRow key={task.id} task={task} onToggle={toggleTask} />)}</div></section>
  </div>{error && <p className="toast-error" role="alert">{error}</p>}</main>;
}

function TaskRow({ task, onToggle }: { task: Task; onToggle: (task: Task) => void }) { const complete = task.status === "completed"; return <article className={`task-row ${complete ? "complete" : ""}`}><button aria-label={complete ? `Mark ${task.title} incomplete` : `Mark ${task.title} complete`} className="check-button" onClick={() => onToggle(task)}>{complete && <CheckIcon size={15} />}</button><div><strong>{task.title}</strong>{task.description && <p>{task.description}</p>}<span className="task-meta"><ClockIcon size={13} /> {task.estimated_minutes ?? 30} min · {dateLabel(task.scheduled_for)}</span></div><span className={`priority ${task.priority}`}>{task.priority}</span></article>; }
