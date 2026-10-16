import { NextResponse } from "next/server";
import { AiPlanningError } from "@/lib/ai/types";
import { StoreError } from "@/lib/goal-store";

export function errorResponse(error: unknown) {
  if (error instanceof AiPlanningError || error instanceof StoreError) return NextResponse.json({ error: error.message, code: error instanceof AiPlanningError ? error.code : undefined }, { status: error.status });
  console.error(error);
  return NextResponse.json({ error: "Something unexpected happened. Please try again." }, { status: 500 });
}

export function readPlanningInput(body: unknown) {
  const value = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const text = (key: string, max = 1200) => typeof value[key] === "string" ? value[key].trim().slice(0, max) : undefined;
  const integer = (key: string) => typeof value[key] === "number" && Number.isFinite(value[key]) ? Math.round(value[key]) : undefined;
  return {
    goal: text("goal") ?? "",
    desiredOutcome: text("desiredOutcome", 800),
    experienceLevel: ["beginner", "some_experience", "intermediate", "advanced"].includes(String(value.experienceLevel)) ? value.experienceLevel as "beginner" | "some_experience" | "intermediate" | "advanced" : undefined,
    minutesPerDay: integer("minutesPerDay"), daysPerWeek: integer("daysPerWeek"),
    desiredDeadline: text("desiredDeadline", 10), currentProgressPercent: integer("currentProgressPercent"),
    currentProgressNote: text("currentProgressNote", 500),
    difficulty: ["easy", "moderate", "challenging"].includes(String(value.difficulty)) ? value.difficulty as "easy" | "moderate" | "challenging" : undefined,
    timeZone: text("timeZone", 80), startDate: text("startDate", 10),
  };
}
