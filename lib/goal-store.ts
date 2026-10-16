import type { User } from "@supabase/supabase-js";
import type { GeneratedGoalPlan, GoalPlanningInput } from "@/lib/ai/types";
import { createClient } from "@/lib/supabase/server";

export class StoreError extends Error {
  constructor(message: string, public readonly status = 500) { super(message); this.name = "StoreError"; }
}

function ensure<T>(data: T | null, error: { message: string } | null, message: string): T {
  if (error || !data) throw new StoreError(error?.message ?? message);
  return data;
}

async function insertPlanItems(userId: string, goalId: string, planVersionId: string, plan: GeneratedGoalPlan) {
  const supabase = await createClient();
  const { data: milestones, error: milestoneError } = await supabase.from("milestones").insert(plan.milestones.map((milestone, position) => ({
    user_id: userId, goal_id: goalId, plan_version_id: planVersionId, title: milestone.title, description: milestone.description,
    success_criteria: milestone.successCriteria, target_day: milestone.targetDay, due_date: milestone.targetDate, position,
    status: position === 0 ? "active" : "upcoming",
  }))).select("id, title");
  const savedMilestones = ensure(milestones, milestoneError, "Could not save milestones.") as Array<{ id: string; title: string }>;
  const milestoneByTitle = new Map(savedMilestones.map((milestone) => [milestone.title.toLowerCase(), milestone.id]));
  const { error: taskError } = await supabase.from("tasks").insert(plan.tasks.map((task, position) => ({
    user_id: userId, goal_id: goalId, plan_version_id: planVersionId,
    milestone_id: task.milestoneClientId ? milestoneByTitle.get(plan.milestones.find((milestone) => milestone.clientId === task.milestoneClientId)?.title.toLowerCase() ?? "") ?? null : null,
    title: task.title, description: task.description, scheduled_day: task.day, scheduled_for: task.dueDate,
    estimated_minutes: task.estimatedMinutes, priority: task.priority, position, status: "pending",
  })));
  if (taskError) throw new StoreError(taskError.message);
}

export async function requireUser(): Promise<User> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new StoreError("Sign in to use your private plan.", 401);
  return user;
}

export async function saveInitialPlan(user: User, input: GoalPlanningInput, plan: GeneratedGoalPlan): Promise<string> {
  const supabase = await createClient();
  const { data: goal, error: goalError } = await supabase.from("goals").insert({
    user_id: user.id, title: input.goal.trim(), desired_outcome: input.desiredOutcome ?? null, input_context: input,
    plan_summary: plan.summary, estimated_days: plan.estimatedDays, planned_start_date: input.startDate ?? new Date().toISOString().slice(0, 10),
    expected_completion_date: plan.expectedCompletionDate, status: "active",
  }).select("id").single();
  const savedGoal = ensure(goal, goalError, "Could not save your goal.") as { id: string };
  const { data: version, error: versionError } = await supabase.from("plan_versions").insert({
    user_id: user.id, goal_id: savedGoal.id, version_number: 1, generation_kind: "initial", plan,
  }).select("id").single();
  const savedVersion = ensure(version, versionError, "Could not save your plan.") as { id: string };
  await insertPlanItems(user.id, savedGoal.id, savedVersion.id, plan);
  const { error: eventError } = await supabase.from("progress_events").insert({ user_id: user.id, goal_id: savedGoal.id, event_type: "plan_generated", metadata: { plan_version_id: savedVersion.id } });
  if (eventError) throw new StoreError(eventError.message);
  return savedGoal.id;
}

export async function getGoalDashboard(user: User, goalId: string) {
  const supabase = await createClient();
  const { data: goal, error: goalError } = await supabase.from("goals").select("*").eq("id", goalId).single();
  const savedGoal = ensure(goal, goalError, "Goal not found.");
  const [{ data: tasks, error: taskError }, { data: milestones, error: milestoneError }, { data: plan, error: planError }] = await Promise.all([
    supabase.from("tasks").select("*").eq("goal_id", goalId).neq("status", "cancelled").order("scheduled_for").order("position"),
    supabase.from("milestones").select("*").eq("goal_id", goalId).order("position"),
    supabase.from("plan_versions").select("plan, version_number, created_at").eq("goal_id", goalId).order("version_number", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (taskError || milestoneError || planError) throw new StoreError(taskError?.message ?? milestoneError?.message ?? planError?.message ?? "Could not load your plan.");
  return { goal: savedGoal, tasks: tasks ?? [], milestones: milestones ?? [], plan: plan ?? null };
}

export async function updateTaskStatus(user: User, taskId: string, status: "pending" | "completed") {
  const supabase = await createClient();
  const { data: task, error: taskError } = await supabase.from("tasks").update({ status, completed_at: status === "completed" ? new Date().toISOString() : null }).eq("id", taskId).select("id, goal_id, milestone_id").single();
  const savedTask = ensure(task, taskError, "Task not found.") as { id: string; goal_id: string; milestone_id: string | null };
  if (savedTask.milestone_id) {
    const { count, error: countError } = await supabase.from("tasks").select("id", { count: "exact", head: true }).eq("milestone_id", savedTask.milestone_id).eq("status", "pending");
    if (countError) throw new StoreError(countError.message);
    const { error: milestoneError } = await supabase.from("milestones").update({ status: status === "completed" && count === 0 ? "completed" : "active", completed_at: status === "completed" && count === 0 ? new Date().toISOString() : null }).eq("id", savedTask.milestone_id);
    if (milestoneError) throw new StoreError(milestoneError.message);
  }
  const { error: eventError } = await supabase.from("progress_events").insert({ user_id: user.id, goal_id: savedTask.goal_id, task_id: savedTask.id, event_type: status === "completed" ? "task_completed" : "task_reopened" });
  if (eventError) throw new StoreError(eventError.message);
  const { count: pendingCount, error: pendingError } = await supabase.from("tasks").select("id", { count: "exact", head: true }).eq("goal_id", savedTask.goal_id).eq("status", "pending");
  if (pendingError) throw new StoreError(pendingError.message);
  const { error: goalError } = await supabase.from("goals").update({ status: pendingCount === 0 ? "completed" : "active", completed_at: pendingCount === 0 ? new Date().toISOString() : null }).eq("id", savedTask.goal_id);
  if (goalError) throw new StoreError(goalError.message);
}

export async function saveAdjustedPlan(user: User, goalId: string, plan: GeneratedGoalPlan, reason: string): Promise<void> {
  const supabase = await createClient();
  const { data: versionRows, error: versionError } = await supabase.from("plan_versions").select("version_number").eq("goal_id", goalId).order("version_number", { ascending: false }).limit(1);
  if (versionError || !versionRows?.length) throw new StoreError(versionError?.message ?? "Goal not found.", 404);
  const nextVersion = Number(versionRows[0].version_number) + 1;
  const { error: cancelError } = await supabase.from("tasks").update({ status: "cancelled" }).eq("goal_id", goalId).eq("status", "pending");
  if (cancelError) throw new StoreError(cancelError.message);
  const { error: removeMilestonesError } = await supabase.from("milestones").delete().eq("goal_id", goalId).neq("status", "completed");
  if (removeMilestonesError) throw new StoreError(removeMilestonesError.message);
  const { data: version, error: insertVersionError } = await supabase.from("plan_versions").insert({ user_id: user.id, goal_id: goalId, version_number: nextVersion, generation_kind: "adjustment", adjustment_reason: reason, plan }).select("id").single();
  const savedVersion = ensure(version, insertVersionError, "Could not save the adjusted plan.") as { id: string };
  await insertPlanItems(user.id, goalId, savedVersion.id, plan);
  const { error: goalError } = await supabase.from("goals").update({ plan_summary: plan.summary, estimated_days: plan.estimatedDays, expected_completion_date: plan.expectedCompletionDate }).eq("id", goalId);
  if (goalError) throw new StoreError(goalError.message);
  const { error: eventError } = await supabase.from("progress_events").insert({ user_id: user.id, goal_id: goalId, event_type: "plan_adjusted", metadata: { plan_version_id: savedVersion.id, reason } });
  if (eventError) throw new StoreError(eventError.message);
}
