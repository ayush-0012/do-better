import { useState, type FormEvent } from "react";
import { Navigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAccount, useSetupOwner, useSetupStatus, useSignIn } from "@/features/account/use-account";

export function SignInPage() {
  const account = useAccount();
  const setupStatus = useSetupStatus(account.data?.state === "signed_out");
  const signIn = useSignIn();
  const setup = useSetupOwner();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [confirmationError, setConfirmationError] = useState("");
  const isSetup = setupStatus.data?.setupRequired === true;
  const pending = signIn.isPending || setup.isPending;
  const error = setup.error ?? signIn.error;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (pending || !setupStatus.isSuccess) return;
    if (isSetup && password !== confirmation) {
      setConfirmationError("Passwords do not match.");
      return;
    }
    setConfirmationError("");
    const mutation = isSetup ? setup : signIn;
    mutation.mutate({ username, password }, { onSuccess: () => { setPassword(""); setConfirmation(""); } });
  }

  if (account.data?.state === "signed_in") return <Navigate to="/overview" replace />;
  const checking = account.isPending || account.data?.state === "checking" || (account.data?.state === "signed_out" && setupStatus.isPending);
  const unavailable = account.isError || account.data?.state === "unavailable" || setupStatus.isError;

  return <section className="public-auth panel" aria-labelledby="sign-in-title">
    <p className="eyebrow">Your workspace</p>
    <h1 id="sign-in-title">{isSetup ? "Set up your workspace" : "Sign in to do-better"}</h1>
    <p>{isSetup ? "Choose the owner's username and password. This installation supports one owner." : "Sign in to run tests on this machine and access your saved reports."}</p>
    {checking ? <p role="status">Checking your workspace…</p> : unavailable ? <>
      <p className="field-error" role="alert">{account.data?.error ?? "Could not reach the master server. Check the connection and try again."}</p>
      <Button variant="outline" onClick={() => { void account.refetch(); void setupStatus.refetch(); }}>Try again</Button>
    </> : <form className="account-form" onSubmit={submit}>
      <label className="field">Username<input autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={(event) => setUsername(event.target.value)} maxLength={64} pattern="[a-zA-Z0-9_.\-]+" required disabled={pending} aria-describedby={isSetup ? "username-help" : undefined} /></label>
      {isSetup && <p id="username-help" className="help-text">Use letters, numbers, dots, underscores, or hyphens.</p>}
      <label className="field">Password<input type="password" autoComplete={isSetup ? "new-password" : "current-password"} value={password} onChange={(event) => { setPassword(event.target.value); setConfirmationError(""); }} minLength={8} maxLength={128} required disabled={pending} aria-describedby={isSetup ? "password-help" : undefined} /></label>
      {isSetup && <>
        <p id="password-help" className="help-text">Use 8–128 characters. Keep this password safe; password recovery is not available.</p>
        <label className="field">Confirm password<input type="password" autoComplete="new-password" value={confirmation} onChange={(event) => { setConfirmation(event.target.value); setConfirmationError(""); }} minLength={8} maxLength={128} required disabled={pending} aria-invalid={Boolean(confirmationError)} aria-describedby={confirmationError ? "confirmation-error" : undefined} /></label>
      </>}
      {confirmationError && <p id="confirmation-error" className="field-error" role="alert">{confirmationError}</p>}
      {error && <p className="field-error" role="alert">{error instanceof Error ? error.message : "Could not sign in. Try again."}</p>}
      <Button type="submit" disabled={pending || !setupStatus.isSuccess}>{pending ? (isSetup ? "Setting up…" : "Signing in…") : (isSetup ? "Create owner account" : "Sign in")}</Button>
    </form>}
  </section>;
}
