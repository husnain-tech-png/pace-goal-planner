import { NextResponse } from "next/server";
import { adjustGoalPlan } from "@/lib/ai/planner";
import type { GeneratedGoalPlan, GoalPlanningInput } from "@/lib/ai/types";
import { errorResponse, readPlanningInput } from "@/lib/api";
import { getGoalDashboard, requireUser, saveAdjustedPlan } from "@/lib/goal-store";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ goalId: string }> }) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 600) : "";
    if (!reason) return NextResponse.json({ error: "Tell us what changed so Pace can adjust the plan." }, { status: 400 });
    const user = await requireUser(); const { goalId } = await context.params;
    const dashboard = await getGoalDashboard(user, goalId);
    const latestPlan = dashboard.plan?.plan as GeneratedGoalPlan | undefined;
    if (!latestPlan) return NextResponse.json({ error: "This goal does not have a plan to adjust." }, { status: 409 });
    const savedInput = dashboard.goal.input_context as GoalPlanningInput;
    const updates = readPlanningInput(body);
    const input: GoalPlanningInput = { ...savedInput, ...Object.fromEntries(Object.entries(updates).filter(([key, value]) => key === "goal" ? Boolean(value) : value !== undefined)), goal: savedInput.goal, startDate: new Date().toISOString().slice(0, 10) };
    const plan = await adjustGoalPlan({ ...input, existingPlan: latestPlan, adjustmentReason: reason, completedTaskIds: dashboard.tasks.filter((task) => task.status === "completed").map((task) => task.id) });
    await saveAdjustedPlan(user, goalId, plan, reason);
    return NextResponse.json({ ok: true, plan });
  } catch (error) { return errorResponse(error); }
}
