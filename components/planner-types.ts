export type ExperienceLevel = "beginner" | "some-experience" | "confident";

export type GoalDifficulty = "gentle" | "balanced" | "ambitious";

export type TaskStatus = "todo" | "completed" | "skipped";

export type MilestoneStatus = "upcoming" | "active" | "complete";

export type PlanHealth = "ahead" | "on-track" | "behind";

export interface GoalIntakeValues {
  goal: string;
  experienceLevel: ExperienceLevel;
  timePerDay: number;
  targetDate?: string;
  currentProgress: string;
  difficulty: GoalDifficulty;
  notes?: string;
}

export interface PlannerGoal {
  id: string;
  title: string;
  summary?: string;
  estimatedDays: number;
  remainingDays: number;
  completionDate?: string;
  progressPercent: number;
  currentStreak?: number;
  weeklyCommitmentHours?: number;
  status?: "active" | "completed" | "paused";
}

export interface PlannerTask {
  id: string;
  title: string;
  description?: string;
  scheduledFor?: string;
  durationMinutes?: number;
  status: TaskStatus;
  priority?: "high" | "medium" | "low";
  isToday?: boolean;
}

export interface PlannerMilestone {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  completedTaskCount?: number;
  taskCount?: number;
  status: MilestoneStatus;
}

export interface ProgressPoint {
  label: string;
  value: number;
  target?: number;
}

export interface PlannerInsight {
  id: string;
  title: string;
  body: string;
  tone?: "positive" | "neutral" | "warning";
}

export interface AuthFormValues {
  email: string;
  password: string;
  fullName?: string;
}
