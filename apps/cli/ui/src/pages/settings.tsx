import { useEffect, useState, type FormEvent } from "react";
import { LockKeyhole, Monitor, Moon, Sun, UserRound } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import {
  useAccount,
  usePendingUploads,
  useRetryPendingUploads,
  useSignIn,
  useSignOut,
  useStartOAuth,
} from "@/features/account/use-account";
import { useAppearance } from "@/features/settings/appearance-provider";

export function SettingsPage() {
  const { theme, setTheme, storageWarning } = useAppearance();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [oauthPending, setOauthPending] = useState(false);

  const account = useAccount(oauthPending);
  const pendingUploads = usePendingUploads();
  const signIn = useSignIn();
  const signOut = useSignOut();
  const startOAuth = useStartOAuth();
  const retryPending = useRetryPendingUploads();

  const accountState = account.data?.state;
  const isSignedIn = accountState === "signed_in";
  const user = account.data?.user;

  useEffect(() => {
    if (accountState === "signed_in") setOauthPending(false);
  }, [accountState]);

  function submit(event: FormEvent) {
    event.preventDefault();
    signIn.mutate({ email, password }, {
      onSuccess: () => setPassword(""),
    });
  }

  const signInError = signIn.error instanceof Error ? signIn.error.message : "";
  const oauthError = startOAuth.error instanceof Error ? startOAuth.error.message : "";
  const retryError = retryPending.error instanceof Error ? retryPending.error.message : "";
  const pendingError = pendingUploads.data?.error;
  const pendingCount = pendingUploads.data?.count ?? 0;
  const retryNotice = retryPending.data
    ? retryPending.data.error
      ?? (retryPending.data.uploaded > 0
        ? `Saved ${retryPending.data.uploaded} run${retryPending.data.uploaded === 1 ? "" : "s"}. ${retryPending.data.remaining} still waiting.`
        : "")
    : "";
  const signInRetry = signIn.data?.retry;

  return <div className="page-container settings-page"><PageHeading eyebrow="Make it your workspace" title="Settings" description="Appearance, your local runner, account, and clear data boundaries." />
    <div className="settings-grid"><aside className="settings-nav" aria-label="Settings sections"><a href="#appearance">Appearance</a><a href="#local-runner">Local runner</a><a href="#account">Account</a><a href="#privacy">Data & privacy</a></aside>
      <div className="settings-sections"><section id="appearance" className="panel settings-section"><h2>Appearance</h2><p>Choose the paper or warm-ink version of the workbench.</p><div className="theme-options" role="group" aria-label="Color theme">
        <button aria-pressed={theme === "light"} onClick={() => setTheme("light")}><div className="theme-swatch theme-light"><span /><span /><span /></div><Sun size={17} />Warm paper</button>
        <button aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}><div className="theme-swatch theme-dark"><span /><span /><span /></div><Moon size={17} />Warm ink</button>
      </div><p className="help-text">Only your appearance preference is stored in this browser. Motion follows your operating system’s reduced-motion preference.</p>{storageWarning && <p role="status" className="field-error">Browser storage is unavailable. The theme applies now but may not survive a reload.</p>}</section>
      <section id="local-runner" className="panel settings-section"><h2><Monitor size={21} />Local runner</h2><p>The CLI server exposes runner status and executes runs while do-better is running.</p><dl className="detail-list"><div><dt>Status</dt><dd><code>GET /api/runner</code></dd></div><div><dt>Start a run</dt><dd><code>POST /api/runs</code></dd></div><div><dt>Default address</dt><dd><code>127.0.0.1:4310</code></dd></div><div><dt>Configuration file</dt><dd><code>do-better.config.json</code></dd></div></dl><div className="command-bar"><code>{'{ "port": 4310, "apiUrl": "http://localhost:3000" }'}</code><CopyButton value={'{ "port": 4310, "apiUrl": "http://localhost:3000" }'} /></div><p className="help-text">Set the port and master API origin in the configuration file in your launch directory, then restart the CLI. The UI does not modify this file.</p></section>
      <section id="account" className="panel settings-section"><h2><UserRound size={21} />Account</h2><p>Sign in to save completed runs to the master database. Target requests still execute on this machine.</p>

        {accountState === "checking" && <p className="account-status" role="status">Checking your saved session with the master server…</p>}
        {accountState === "unavailable" && <div className="notice notice-error" role="status"><strong>Session check failed.</strong> {account.data?.error} <Button size="sm" variant="ghost" onClick={() => void account.refetch()}>Try again</Button></div>}

        {isSignedIn && <div className="account-summary">
          <div className="account-identity"><strong>{user?.name || user?.email || "Signed in"}</strong><span>{user?.email}</span></div>
          <span className="quiet-tag text-success">Signed in</span>
        </div>}

        {isSignedIn && <dl className="detail-list account-details">
          <div><dt>Project</dt><dd>{account.data?.projectId ? <code>{shortId(account.data.projectId)}</code> : "Created after your next run"}</dd></div>
          <div><dt>Master server</dt><dd><code>{account.data?.backendUrl}</code></dd></div>
        </dl>}

        {isSignedIn && <div className="account-pending">
          <div><h3>Saved runs</h3><p>{pendingUploads.isPending ? "Checking saved runs…" : pendingError ? pendingError : pendingCount === 0 ? "No runs waiting to upload." : `${pendingCount} run${pendingCount === 1 ? "" : "s"} waiting to upload.`}</p></div>
          <Button size="sm" variant="outline" onClick={() => retryPending.mutate()} disabled={retryPending.isPending || pendingCount === 0 || Boolean(pendingError)}>{retryPending.isPending ? "Retrying…" : "Retry uploads"}</Button>
        </div>}
        {(retryNotice || retryError || signInRetry?.error) && <p className="help-text account-note" role="status">{retryError || signInRetry?.error || retryNotice}</p>}
        {signInRetry && signInRetry.uploaded > 0 && <p className="help-text account-note" role="status">Saved {signInRetry.uploaded} pending run{signInRetry.uploaded === 1 ? "" : "s"} on sign-in.</p>}

        {isSignedIn && <div className="account-actions">
          <Button variant="outline" onClick={() => signOut.mutate()} disabled={signOut.isPending}>{signOut.isPending ? "Signing out…" : "Sign out"}</Button>
          {signOut.data?.warning && <p className="field-error" role="status">{signOut.data.warning}</p>}
        </div>}

        {!isSignedIn && accountState !== "checking" && <>
          <form className="account-form" onSubmit={submit}>
            <label className="field">Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <label className="field">Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
            {signInError && <p className="field-error" role="alert">{signInError}</p>}
            <Button type="submit" disabled={signIn.isPending}>{signIn.isPending ? "Signing in…" : "Sign in"}</Button>
          </form>
          <div className="account-divider">or</div>
          <div className="account-oauth">
            <Button type="button" variant="outline" onClick={() => startOAuth.mutate("google", { onSuccess: () => setOauthPending(true) })} disabled={startOAuth.isPending || oauthPending}>Continue with Google</Button>
            <Button type="button" variant="outline" onClick={() => startOAuth.mutate("github", { onSuccess: () => setOauthPending(true) })} disabled={startOAuth.isPending || oauthPending}>Continue with GitHub</Button>
          </div>
          {oauthPending && <div className="notice account-note" role="status"><strong>Waiting for browser sign-in.</strong> Complete the provider step in the browser tab that opened. <Button size="sm" variant="ghost" onClick={() => setOauthPending(false)}>Stop waiting</Button></div>}
          {oauthError && <p className="field-error account-note" role="alert">{oauthError}</p>}
        </>}
      </section>
      <section id="privacy" className="panel settings-section"><h2><LockKeyhole size={21} />Data & privacy</h2><ul className="privacy-list"><li><strong>Requests execute locally.</strong> Target calls belong to the engine on your computer.</li><li><strong>Payloads stay local.</strong> Request headers and bodies are excluded from master uploads.</li><li><strong>Runs save automatically.</strong> When you are signed in, completed run metrics upload to the master database.</li><li><strong>Failed saves wait locally.</strong> Unsaved runs remain in <code>~/.do-better</code> for retry and are never rerun. They contain the target URL and aggregate metrics, not headers or request bodies.</li><li><strong>Response bodies are discarded.</strong> They are consumed for timing and never stored as result content.</li><li><strong>Drafts remain in memory.</strong> Reloading this page clears request payloads and headers. Your session is stored locally and checked with the master on startup.</li></ul></section>
    </div></div>
  </div>;
}

function shortId(value: string) {
  return value.length > 8 ? value.slice(0, 8) : value;
}
