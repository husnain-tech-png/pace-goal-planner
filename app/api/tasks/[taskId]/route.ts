import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { requireUser, updateTaskStatus } from "@/lib/goal-store";

export async function PATCH(request: Request, context: { params: Promise<{ taskId: string }> }) {
  try {
    const body = await request.json() as { status?: string };
    if (body.status !== "pending" && body.status !== "completed") return NextResponse.json({ error: "Status must be pending or completed." }, { status: 400 });
    const user = await requireUser(); const { taskId } = await context.params;
    await updateTaskStatus(user, taskId, body.status);
    return NextResponse.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
