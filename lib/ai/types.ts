/**
 * Server-side domain types for the goal planning flow.  These types deliberately
 * do not mirror a database schema so they can be used by an API route before
 * the generated plan is persisted to Supabase.
 */

export const EXPERIENCE_LEVELS = [
  "beginner",
  "some_experience",
  "intermediate",
  "advanced",
] as const;

export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const DIFFICULTY_LEVELS = ["easy", "moderate", "challenging"] as const;

export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

export const TASK_PRIORITIES = ["low", "medium", "high"] as const;

export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/** The information needed to turn one user's natural-language goal into a plan. */
export interface GoalPlanningInput {
  /** The user's goal exactly as they described it. */
  goal: string;
  /** A useful, optional refinement such as "build and publish a portfolio site". */
  desiredOutcome?: string;
  experienceLevel?: ExperienceLevel;
  /** Minutes the user can commit on a typical active day. */
  minutesPerDay?: number;
  /** Active days available in a typical week. */
  daysPerWeek?: number;
  /** Local calendar date (YYYY-MM-DD), if the user has a deadline. */
  desiredDeadline?: string;
  /** A percentage from 0 to 100 indicating work already completed. */
  currentProgressPercent?: number;
  currentProgressNote?: string;
  difficulty?: DifficultyLevel;
  /** IANA timezone, used only to calculate display dates. */
  timeZone?: string;
  /** The local calendar date from which the plan should start. */
  startDate?: string;
}

/**
 * Information supplied when an already-created plan needs a new schedule.
 * `existingPlan` should be the original persisted/generated plan; callers may
 * attach database ids separately without exposing them to the model.
 */
export interface GoalPlanAdjustmentInput extends GoalPlanningInput {
  existingPlan: GeneratedGoalPlan;
  /** A concise user-facing explanation, e.g. "I missed three days this week". */
  adjustmentReason: string;
  /** Task ids that were completed after the plan was generated. */
  completedTaskIds?: string[];
}

export interface PlanSchedule {
  minutesPerDay: number;
  daysPerWeek: number;
  recommendedDays: string[];
  weeklyFocus: string;
}

export interface PlanMilestone {
  /** Deterministic client id; use a database id after persistence if needed. */
  clientId: string;
  title: string;
  description: string;
  /** One-based active-plan day. */
  targetDay: number;
  /** Local calendar date calculated from the plan cadence. */
  targetDate: string;
  successCriteria: string;
}

export interface PlanTask {
  /** Deterministic client id; use a database id after persistence if needed. */
  clientId: string;
  /** One-based active-plan day. More than one task may share a day. */
  day: number;
  /** Local calendar date calculated from the plan cadence. */
  dueDate: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  priority: TaskPriority;
  /** A matching PlanMilestone clientId, when the task supports one. */
  milestoneClientId: string | null;
}

export interface GeneratedGoalPlan {
  summary: string;
  estimatedDays: number;
  expectedCompletionDate: string;
  rationale: string;
  schedule: PlanSchedule;
  milestones: PlanMilestone[];
  tasks: PlanTask[];
  recommendations: string[];
  /** ISO timestamp of the API response normalization. */
  generatedAt: string;
}

/** The model's intentionally database-agnostic structured response shape. */
export interface RawGoalPlan {
  summary: string;
  estimatedDays: number;
  rationale: string;
  schedule: {
    minutesPerDay: number;
    daysPerWeek: number;
    recommendedDays: string[];
    weeklyFocus: string;
  };
  milestones: Array<{
    title: string;
    description: string;
    targetDay: number;
    successCriteria: string;
  }>;
  tasks: Array<{
    day: number;
    title: string;
    description: string;
    estimatedMinutes: number;
    priority: TaskPriority;
    milestoneTitle: string | null;
  }>;
  recommendations: string[];
}

export type AiPlanningErrorCode =
  | "INVALID_INPUT"
  | "MISSING_API_KEY"
  | "AI_REQUEST_FAILED"
  | "AI_RESPONSE_INCOMPLETE"
  | "AI_RESPONSE_INVALID";

export class AiPlanningError extends Error {
  public readonly code: AiPlanningErrorCode;
  public readonly status: number;
  public readonly cause?: unknown;

  constructor(
    code: AiPlanningErrorCode,
    message: string,
    status: number,
    cause?: unknown,
  ) {
    super(message);
    this.name = "AiPlanningError";
    this.code = code;
    this.status = status;
    this.cause = cause;
  }
}

export interface OpenAiPlannerOptions {
  /** Defaults to process.env.OPENAI_API_KEY. Never send this value to clients. */
  apiKey?: string;
  /** Defaults to OPENAI_MODEL, then gpt-4.1-mini. */
  model?: string;
  /** Allows route tests to provide a fake fetch without changing production behavior. */
  fetchImpl?: typeof fetch;
  /** Defaults to 45 seconds. */
  timeoutMs?: number;
}
