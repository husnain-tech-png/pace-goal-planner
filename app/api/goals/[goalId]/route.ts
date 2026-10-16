import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { getGoalDashboard, requireUser } from "@/lib/goal-store";

export async function GET(_: Request, context: { params: Promise<{ goalId: string }> }) {
  try { const user = await requireUser(); const { goalId } = await context.params; return NextResponse.json(await getGoalDashboard(user, goalId)); }
  catch (error) { return errorResponse(error); }
}
