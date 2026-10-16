import { AuthPanel } from "@/components/auth-panel";

export default function LoginPage() {
  return <main className="login-page"><a className="wordmark" href="/">pace<span>.</span></a><div><p className="eyebrow">Welcome back</p><h1>Make room for what matters.</h1><AuthPanel /></div></main>;
}
