# Pace — AI Goal Planner

Pace turns a natural-language goal into a realistic AI plan, then stores progress in Supabase. The MVP includes email/password authentication, private user-scoped goals, AI-generated tasks and milestones, instant completion updates, and AI plan adjustment when availability changes.

## Run locally

1. Copy `.env.example` to `.env.local`.
2. Add your Supabase project URL and publishable key. These are browser-safe because every application table is protected with row-level security.
3. Add an `OPENAI_API_KEY`. It is used only in the server-side route and is never exposed to the browser.
4. Apply [202609140001_goal_planner.sql](supabase/migrations/202609140001_goal_planner.sql) to your Supabase project.
5. Run `npm install` and `npm run dev`, then visit `http://localhost:3000`.

For production, configure the same three environment variables on the hosting platform. In Supabase Auth, add your local URL and production URL to the allowed redirect URLs for email confirmation. Email confirmation returns through `/auth/callback` to create the signed-in session.

## Architecture

- `app/api/plans` creates a plan through the server-side OpenAI Responses API, then persists the plan, tasks, milestones, and an audit event.
- `app/api/tasks/[taskId]` updates task state immediately; the database RLS policies ensure only the owning user can change it.
- `app/api/goals/[goalId]/adjust` sends the current plan and completed tasks to the model, creates a new plan version, and safely retires incomplete tasks from the prior schedule.
- `supabase/migrations` contains the whole schema: profiles, goals, plan versions, tasks, milestones, progress events, indexes, ownership policies, and triggers.

## Security notes

- Never place `OPENAI_API_KEY` or a Supabase service-role key in a `NEXT_PUBLIC_` variable.
- The schema enables RLS on every public table and verifies `auth.uid()` ownership for every read/write policy.
- The API uses the authenticated user’s cookie-bound Supabase client, so database access is still RLS-enforced on the server.
