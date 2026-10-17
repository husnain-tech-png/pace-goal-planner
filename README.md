# Pace — AI Goal Planner

Pace turns a natural-language goal into a realistic AI plan, then stores progress in Supabase. The MVP includes email/password authentication, private user-scoped goals, AI-generated tasks and milestones, instant completion updates, and AI plan adjustment when availability changes.

## Run locally

1. Copy `.env.example` to `.env.local`.
2. Add your Supabase project URL and publishable key. These are browser-safe because every application table is protected with row-level security.
3. Add your AI API credentials:
   - For plan generation: set `OPENAI_API_KEY` (server-side only, never exposed to the browser).
   - For the AI Coach Chatbot: set `AI_API_KEY` (or fallback to `OPENAI_API_KEY`), and optionally customize `AI_BASE_URL` (e.g. `https://api.x.ai/v1`, Groq, or OpenAI) and `AI_MODEL`.
4. Apply the Supabase database migrations:
   - [202609140001_goal_planner.sql](supabase/migrations/202609140001_goal_planner.sql) (Core goal planner tables, policies, and triggers)
   - [20261016_add_daily_logs.sql](supabase/migrations/20261016_add_daily_logs.sql) (`daily_logs` table for streak tracking and habits)
5. Run `npm install` and `npm run dev`, then visit `http://localhost:3000`.

For production, configure the environment variables on the hosting platform. In Supabase Auth, add your local URL and production URL to the allowed redirect URLs for email confirmation. Email confirmation returns through `/auth/callback` to create the signed-in session.

## Architecture

- `app/api/plans` creates a plan through the server-side OpenAI Responses API, then persists the plan, tasks, milestones, and an audit event.
- `app/api/tasks/[taskId]` updates task state immediately; the database RLS policies ensure only the owning user can change it.
- `app/api/goals/[goalId]/adjust` sends the current plan and completed tasks to the model, creates a new plan version, and safely retires incomplete tasks from the prior schedule.
- `app/api/chat` powers the context-aware Pace AI coach chatbot; compatible with Grok, Groq, and OpenAI `/chat/completions` endpoints.
- `components/AiCoachChat.tsx` renders the floating trigger and interactive sliding drawer for conversational productivity coaching.
- `components/HabitTracker.tsx` provides daily checklists, dynamic streak counting, progress visualization, and a 25-minute Pomodoro focus timer synced to Supabase.
- `supabase/migrations` contains the full database schema: profiles, goals, plan versions, tasks, milestones, progress events, daily logs, indexes, and ownership RLS policies.

## Security notes

- Never place `OPENAI_API_KEY`, `AI_API_KEY`, or a Supabase service-role key in a `NEXT_PUBLIC_` variable.
- The schema enables RLS on every public table and verifies `auth.uid()` ownership for every read/write policy.
- The API uses the authenticated user’s cookie-bound Supabase client, so database access is still RLS-enforced on the server.
