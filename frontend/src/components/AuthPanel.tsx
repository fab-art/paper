import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Cloud, LogIn, LogOut, ShieldCheck, X } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

type AuthMode = "password" | "signup" | "magic";

export default function AuthPanel() {
  const [session, setSession] = useState<Session | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("magic");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        setOpen(false);
        setPassword("");
        setMessage("");
        setError("");
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      if (mode === "password") {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
      } else if (mode === "signup") {
        const { error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (authError) throw authError;
        setMessage("Check your email to confirm your account before signing in.");
      } else {
        const { error: authError } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { emailRedirectTo: window.location.origin },
        });
        if (authError) throw authError;
        setMessage("A secure sign-in link has been sent to your email.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    setBusy(true);
    const { error: authError } = await supabase.auth.signOut({ scope: "local" });
    setBusy(false);
    if (authError) setError(authError.message);
    else setMessage("You are signed out. Your local projects remain on this device.");
  };

  if (!isSupabaseConfigured) {
    return <span className="cloud-auth-status" title="Add the Supabase URL and publishable key to enable cloud collaboration">
      <Cloud size={14}/> Cloud not configured
    </span>;
  }

  if (session?.user) {
    return <div className="cloud-auth-user">
      <span title={session.user.email || "Signed in"}><ShieldCheck size={14}/>{session.user.email || "Signed in"}</span>
      <button type="button" className="cloud-auth-button" onClick={() => void signOut()} disabled={busy}>
        <LogOut size={14}/> Sign out
      </button>
    </div>;
  }

  return <>
    <button type="button" className="cloud-auth-button" onClick={() => { setOpen(true); setError(""); setMessage(""); }}>
      <LogIn size={14}/> Sign in
    </button>
    {open && <div className="cloud-auth-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="cloud-auth-dialog" role="dialog" aria-modal="true" aria-labelledby="cloud-auth-title">
        <button type="button" className="cloud-auth-close" aria-label="Close sign-in dialog" onClick={() => setOpen(false)}><X size={17}/></button>
        <div className="cloud-auth-mark"><Cloud size={20}/></div>
        <div className="cloud-auth-eyebrow">PAPERORCHESTRA ACCOUNT</div>
        <h2 id="cloud-auth-title">Access your research team</h2>
        <p>Sign in to prepare for shared projects. Your existing local projects stay private unless you explicitly share them.</p>
        <div className="cloud-auth-modes" role="tablist" aria-label="Sign-in method">
          <button type="button" role="tab" aria-selected={mode === "magic"} className={mode === "magic" ? "active" : ""} onClick={() => {setMode("magic");setError("");setMessage("");}}>Email link</button>
          <button type="button" role="tab" aria-selected={mode === "password"} className={mode === "password" ? "active" : ""} onClick={() => {setMode("password");setError("");setMessage("");}}>Password</button>
          <button type="button" role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "active" : ""} onClick={() => {setMode("signup");setError("");setMessage("");}}>Create account</button>
        </div>
        <form onSubmit={event => void submit(event)}>
          <label>Email address<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com"/></label>
          {mode !== "magic" && <label>Password<input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={mode === "signup" ? 8 : undefined} value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters"/></label>}
          <button className="cloud-auth-submit" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "signup" ? "Create account" : mode === "password" ? "Sign in securely" : "Email me a sign-in link"}</button>
        </form>
        {message && <p className="cloud-auth-message" role="status">{message}</p>}
        {error && <p className="cloud-auth-error" role="alert">{error}</p>}
        <small><ShieldCheck size={12}/> Secure authentication powered by Supabase. No service-role key is sent to the browser.</small>
      </section>
    </div>}
  </>;
}
