import { NextResponse } from "next/server";

// ── Env-driven provider config ──────────────────────────────────────
function aiConfig() {
  const apiKey = process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.AI_BASE_URL ?? "https://api.x.ai/v1").replace(/\/+$/, "");
  const model = process.env.AI_MODEL ?? "grok-3-mini";
  return { apiKey, baseUrl, model };
}

// ── System prompt ───────────────────────────────────────────────────
function systemPrompt(activeGoals: { title: string; summary?: string }[]) {
  const goalBlock =
    activeGoals.length > 0
      ? `\n\nThe user's active goals:\n${activeGoals.map((g, i) => `${i + 1}. ${g.title}${g.summary ? ` — ${g.summary}` : ""}`).join("\n")}`
      : "";

  return `You are Pace AI, a sharp, practical, motivating productivity coach embedded in the Pace goal-planning app.
Your tone is warm but direct — like a trusted mentor who respects the user's time.

Core capabilities:
- Help users break bottlenecks blocking their goals.
- Suggest concrete next actions and schedule adjustments.
- Motivate without being cheesy — use evidence and specificity.
- Give honest feedback if a plan or timeline is unrealistic.

Rules:
- Keep replies concise (under 250 words unless the user asks for detail).
- When referencing goals, use the user's own wording.
- Never fabricate data. If you need more context, ask.
- Format replies in clean markdown when helpful.${goalBlock}`;
}

// ── Route handler ───────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const { apiKey, baseUrl, model } = aiConfig();

    if (!apiKey) {
      return NextResponse.json(
        { error: "AI is not configured. Add AI_API_KEY (or OPENAI_API_KEY) to your server environment." },
        { status: 500 },
      );
    }

    // Parse request body
    let messages: { role: string; content: string }[];
    let activeGoals: { title: string; summary?: string }[];
    try {
      const body = await req.json();
      messages = Array.isArray(body.messages) ? body.messages : [];
      activeGoals = Array.isArray(body.activeGoals) ? body.activeGoals : [];
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    if (!messages.length || !messages.some((m) => m.role === "user")) {
      return NextResponse.json({ error: "Provide at least one user message." }, { status: 400 });
    }

    // Build OpenAI-compatible request
    const chatMessages = [
      { role: "system", content: systemPrompt(activeGoals) },
      ...messages.slice(-30).map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content).slice(0, 4000),
      })),
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    const upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: chatMessages,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    clearTimeout(timeout);

    if (!upstream.ok) {
      const errBody = await upstream.text().catch(() => "");
      console.error(`AI upstream error ${upstream.status}:`, errBody);
      return NextResponse.json(
        { error: `AI service returned ${upstream.status}. Check your AI_API_KEY and AI_BASE_URL.` },
        { status: 502 },
      );
    }

    const data = (await upstream.json()) as {
      choices?: { message?: { content?: string } }[];
    };

    const reply = data.choices?.[0]?.message?.content ?? "";

    return NextResponse.json({ reply });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return NextResponse.json({ error: "AI request timed out." }, { status: 504 });
    }
    console.error("Chat API error:", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
