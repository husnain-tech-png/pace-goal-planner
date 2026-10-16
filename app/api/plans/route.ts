import { NextResponse } from "next/server";
import { generateGoalPlan } from "@/lib/ai/planner";
import { errorResponse, readPlanningInput } from "@/lib/api";
import { requireUser, saveInitialPlan } from "@/lib/goal-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = readPlanningInput(await request.json());
    const plan = await generateGoalPlan({ ...input, timeZone: input.timeZone ?? "UTC", startDate: input.startDate ?? new Date().toISOString().slice(0, 10) });
    const goalId = await saveInitialPlan(user, input, plan);
    return NextResponse.json({ goalId, plan }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
