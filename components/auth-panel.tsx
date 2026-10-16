"use client";

import { FormEvent, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export function AuthPanel({ onSuccess }: { onSuccess?: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSupabaseConfigured()) { setMessage("Supabase is not connected yet. Add the public project URL and key from .env.example, then try again."); return; }
    setLoading(true); setMessage("");
    const supabase = createClient();
    const result = mode === "signup"
      ? await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName }, emailRedirectTo: `${location.origin}/auth/callback` } })
      : await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (result.error) return setMessage(result.error.message);
    if (mode === "signup" && !result.data.session) return setMessage("Check your inbox to confirm your email, then come back to start planning.");
    setMessage("You’re in. Your plan is ready when you are.");
    onSuccess?.();
  }

  return <section className="auth-card" aria-label="Sign in or create an account">
    <div className="auth-tabs"><button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>Create account</button><button className={mode === "signin" ? "active" : ""} onClick={() => setMode("signin")}>Sign in</button></div>
    <form onSubmit={submit} className="form-stack">
      {mode === "signup" && <label>First name <input required value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Alex" autoComplete="name" /></label>}
      <label>Email <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" /></label>
      <label>Password <input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8+ characters" autoComplete={mode === "signup" ? "new-password" : "current-password"} /></label>
      <button className="button button-dark" disabled={loading} type="submit">{loading ? "One moment…" : mode === "signup" ? "Start planning" : "Continue"}</button>
      {message && <p className="form-message" role="status">{message}</p>}
    </form>
  </section>;
}
