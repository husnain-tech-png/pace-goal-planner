import {
  AiPlanningError,
  type GeneratedGoalPlan,
  type GoalPlanAdjustmentInput,
  type GoalPlanningInput,
  type OpenAiPlannerOptions,
  type PlanMilestone,
  type PlanTask,
  type RawGoalPlan,
} from "./types";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function asText(value: unknown, field: string, maxLength = 800): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new AiPlanningError("AI_RESPONSE_INVALID", `The plan is missing ${field}.`, 502);
  }
  return value.trim().slice(0, maxLength);
}

function asInteger(value: unknown, field: string, min: number, max: number): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new AiPlanningError("AI_RESPONSE_INVALID", `The plan has an invalid ${field}.`, 502);
  }
  return number;
}

function parseRawPlan(value: unknown): RawGoalPlan {
  if (!value || typeof value !== "object") {
    throw new AiPlanningError("AI_RESPONSE_INVALID", "The AI did not return a plan object.", 502);
  }
  const result = value as Record<string, unknown>;
  const schedule = result.schedule as Record<string, unknown> | undefined;
  const rawMilestones = result.milestones;
  const rawTasks = result.tasks;
  const rawRecommendations = result.recommendations;
  if (!schedule || !Array.isArray(rawMilestones) || !Array.isArray(rawTasks) || !Array.isArray(rawRecommendations)) {
    throw new AiPlanningError("AI_RESPONSE_INVALID", "The AI returned an incomplete plan.", 502);
  }

  return {
    summary: asText(result.summary, "summary"),
    estimatedDays: asInteger(result.estimatedDays, "estimatedDays", 1, 3650),
    rationale: asText(result.rationale, "rationale"),
    schedule: {
      minutesPerDay: asInteger(schedule.minutesPerDay, "schedule.minutesPerDay", 10, 720),
      daysPerWeek: asInteger(schedule.daysPerWeek, "schedule.daysPerWeek", 1, 7),
      recommendedDays: Array.isArray(schedule.recommendedDays)
        ? schedule.recommendedDays.filter((day): day is string => typeof day === "string" && WEEKDAYS.includes(day)).slice(0, 7)
        : [],
      weeklyFocus: asText(schedule.weeklyFocus, "schedule.weeklyFocus"),
    },
    milestones: rawMilestones.slice(0, 20).map((item, index) => {
      const milestone = item as Record<string, unknown>;
      return {
        title: asText(milestone.title, `milestone ${index + 1} title`, 140),
        description: asText(milestone.description, `milestone ${index + 1} description`, 500),
        targetDay: asInteger(milestone.targetDay, `milestone ${index + 1} targetDay`, 1, 3650),
        successCriteria: asText(milestone.successCriteria, `milestone ${index + 1} successCriteria`, 300),
      };
    }),
    tasks: rawTasks.slice(0, 180).map((item, index) => {
      const task = item as Record<string, unknown>;
      const priority = task.priority;
      if (priority !== "low" && priority !== "medium" && priority !== "high") {
        throw new AiPlanningError("AI_RESPONSE_INVALID", `Task ${index + 1} has an invalid priority.`, 502);
      }
      return {
        day: asInteger(task.day, `task ${index + 1} day`, 1, 3650),
        title: asText(task.title, `task ${index + 1} title`, 160),
        description: asText(task.description, `task ${index + 1} description`, 600),
        estimatedMinutes: asInteger(task.estimatedMinutes, `task ${index + 1} estimatedMinutes`, 5, 720),
        priority,
        milestoneTitle: typeof task.milestoneTitle === "string" ? task.milestoneTitle.trim().slice(0, 140) : null,
      };
    }),
    recommendations: rawRecommendations.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).slice(0, 6),
  };
}

function parseJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch (cause) {
    throw new AiPlanningError("AI_RESPONSE_INVALID", "The AI returned malformed plan data.", 502, cause);
  }
}

function startOfDay(value?: string): Date {
  const result = value ? new Date(`${value}T12:00:00`) : new Date();
  if (Number.isNaN(result.valueOf())) return new Date();
  result.setHours(12, 0, 0, 0);
  return result;
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function recommendedDays(daysPerWeek: number, supplied: string[]): string[] {
  const valid = [...new Set(supplied.filter((day) => WEEKDAYS.includes(day)))];
  if (valid.length >= daysPerWeek) return valid.slice(0, daysPerWeek);
  return WEEKDAYS.filter((day) => !valid.includes(day)).slice(0, daysPerWeek - valid.length).concat(valid).sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b));
}

function activeDateForDay(startDate: Date, planDay: number, activeDays: string[]): string {
  const cursor = new Date(startDate);
  let completedActiveDays = 0;
  while (completedActiveDays < planDay - 1) {
    cursor.setDate(cursor.getDate() + 1);
    if (activeDays.includes(WEEKDAYS[(cursor.getDay() + 6) % 7])) completedActiveDays += 1;
  }
  return formatDate(cursor);
}

function normalizePlan(raw: RawGoalPlan, input: GoalPlanningInput): GeneratedGoalPlan {
  const startDate = startOfDay(input.startDate);
  const days = recommendedDays(raw.schedule.daysPerWeek, raw.schedule.recommendedDays);
  const milestones: PlanMilestone[] = raw.milestones
    .sort((a, b) => a.targetDay - b.targetDay)
    .map((milestone, index) => ({
      ...milestone,
      clientId: `milestone-${index + 1}`,
      targetDate: activeDateForDay(startDate, milestone.targetDay, days),
    }));
  const tasks: PlanTask[] = raw.tasks
    .sort((a, b) => a.day - b.day)
    .map((task, index) => ({
      clientId: `task-${index + 1}`,
      day: task.day,
      dueDate: activeDateForDay(startDate, task.day, days),
      title: task.title,
      description: task.description,
      estimatedMinutes: task.estimatedMinutes,
      priority: task.priority,
      milestoneClientId: milestones.find((milestone) => milestone.title.toLowerCase() === task.milestoneTitle?.toLowerCase())?.clientId ?? null,
    }));
  const latestDay = Math.max(raw.estimatedDays, ...tasks.map((task) => task.day), 1);

  return {
    summary: raw.summary,
    estimatedDays: latestDay,
    expectedCompletionDate: activeDateForDay(startDate, latestDay, days),
    rationale: raw.rationale,
    schedule: { ...raw.schedule, recommendedDays: days },
    milestones,
    tasks,
    recommendations: raw.recommendations,
    generatedAt: new Date().toISOString(),
  };
}

function plannerInstruction(): string {
  return `You are Pace, an empathetic and pragmatic goal-planning coach. Create a realistic, concrete plan—not generic advice. Return ONLY valid JSON with this exact top-level shape: {summary, estimatedDays, rationale, schedule, milestones, tasks, recommendations}. schedule is {minutesPerDay, daysPerWeek, recommendedDays, weeklyFocus}. milestones is an array of {title, description, targetDay, successCriteria}. tasks is an array of {day, title, description, estimatedMinutes, priority, milestoneTitle}. Use Mon through Sun for recommendedDays and low, medium, or high for priority. Include enough tasks to make each active planning day actionable, but keep a maximum of 90 tasks. Do not claim you performed tasks. Be honest where a deadline is unrealistic and optimize for sustainable progress.`;
}

async function callModel(input: GoalPlanningInput, options: OpenAiPlannerOptions, adjustment?: GoalPlanAdjustmentInput): Promise<RawGoalPlan> {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AiPlanningError("MISSING_API_KEY", "AI planning is not configured. Add OPENAI_API_KEY on the server.", 503);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 45_000);
  const requestInput = adjustment
    ? { type: "plan_adjustment", input, adjustmentReason: adjustment.adjustmentReason, completedTaskIds: adjustment.completedTaskIds ?? [], priorPlan: adjustment.existingPlan }
    : { type: "new_plan", input };
  try {
    const response = await (options.fetchImpl ?? fetch)("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      body: JSON.stringify({ model: options.model ?? process.env.OPENAI_MODEL ?? "gpt-5-mini", store: false, instructions: plannerInstruction(), input: JSON.stringify(requestInput), text: { format: { type: "json_object" } } }),
    });
    const body = (await response.json()) as { output_text?: unknown; error?: { message?: unknown } };
    if (!response.ok) {
      throw new AiPlanningError("AI_REQUEST_FAILED", typeof body.error?.message === "string" ? body.error.message : "The AI request failed.", 502);
    }
    if (typeof body.output_text !== "string" || !body.output_text.trim()) {
      throw new AiPlanningError("AI_RESPONSE_INCOMPLETE", "The AI returned no planning content.", 502);
    }
    return parseRawPlan(parseJson(body.output_text));
  } catch (error) {
    if (error instanceof AiPlanningError) throw error;
    throw new AiPlanningError("AI_REQUEST_FAILED", "Could not reach the AI planning service.", 502, error);
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateGoalPlan(input: GoalPlanningInput, options: OpenAiPlannerOptions = {}): Promise<GeneratedGoalPlan> {
  if (!input.goal?.trim() || input.goal.trim().length > 1200) throw new AiPlanningError("INVALID_INPUT", "Enter a goal between 1 and 1,200 characters.", 400);
  return normalizePlan(await callModel(input, options), input);
}

export async function adjustGoalPlan(input: GoalPlanAdjustmentInput, options: OpenAiPlannerOptions = {}): Promise<GeneratedGoalPlan> {
  if (!input.adjustmentReason?.trim()) throw new AiPlanningError("INVALID_INPUT", "Explain what changed before adjusting the plan.", 400);
  return normalizePlan(await callModel(input, options, input), input);
}
