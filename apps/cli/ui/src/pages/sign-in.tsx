import { useState, type FormEvent } from "react";
import { Navigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAccount, useSignIn, useSignUp } from "@/features/account/use-account";

export function SignInPage() {
  const account = useAccount();
  const signIn = useSignIn();
  const signUp = useSignUp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [name, setName] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (isCreatingAccount) {
      signUp.mutate({ name, email, password }, { onSuccess: () => setPassword("") });
    } else {
      signIn.mutate({ email, password }, { onSuccess: () => setPassword("") });
    }
  }

  const authPending = signIn.isPending || signUp.isPending;
  const authError = isCreatingAccount ? signUp.error : signIn.error;
  if (account.data?.state === "signed_in") return <Navigate to="/overview" replace />;

  const checking = account.isPending || account.data?.state === "checking";
  return <section className="public-auth panel" aria-labelledby="sign-in-title">
    <p className="eyebrow">Your workspace</p>
    <h1 id="sign-in-title">{isCreatingAccount ? "Create an account" : "Sign in to do-better"}</h1>
    <p>Sign in to run tests on this machine and access your saved reports.</p>
    {checking ? <p role="status">Checking your saved session…</p> : <>
      {account.data?.state === "unavailable" && <p className="field-error" role="status">{account.data.error}</p>}
      <form className="account-form" onSubmit={submit}>
        {isCreatingAccount && <label className="field">Name<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required disabled={authPending} /></label>}
        <label className="field">Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={320} required disabled={authPending} /></label>
        <label className="field">Password<input type="password" autoComplete={isCreatingAccount ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={isCreatingAccount ? 8 : undefined} maxLength={isCreatingAccount ? 128 : 1024} required disabled={authPending} aria-describedby={isCreatingAccount ? "account-password-help" : undefined} /></label>
        {isCreatingAccount && <p id="account-password-help" className="help-text">Use 8–128 characters. Email verification and password recovery are not available yet.</p>}
        {authError && <p className="field-error" role="alert">{authError instanceof Error ? authError.message : "Could not complete authentication. Try again."}</p>}
        <Button type="submit" disabled={authPending}>{authPending ? (isCreatingAccount ? "Creating account…" : "Signing in…") : (isCreatingAccount ? "Create account" : "Sign in")}</Button>
        <Button type="button" variant="ghost" disabled={authPending} onClick={() => {
          setIsCreatingAccount(!isCreatingAccount);
          setPassword("");
          signIn.reset();
          signUp.reset();
        }}>{isCreatingAccount ? "Already have an account? Sign in" : "New here? Create an account"}</Button>
      </form>
    </>}
  </section>;
}
