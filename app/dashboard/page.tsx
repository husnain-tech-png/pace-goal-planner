import { PlannerDashboard } from "@/components/planner-dashboard";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ goal?: string }> }) {
  const { goal } = await searchParams;
  if (!goal) return <main className="page-shell empty-state"><a className="wordmark" href="/">pace<span>.</span></a><h1>Choose a goal to begin.</h1><p>Create a private AI plan, then your progress dashboard will live here.</p><a className="button button-dark" href="/">Create a plan</a></main>;
  return <PlannerDashboard goalId={goal} />;
}
