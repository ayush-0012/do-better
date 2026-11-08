import { LockKeyhole, Monitor, Moon, Sun, UserRound } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import {
  useAccount,
  usePendingUploads,
  useRetryPendingUploads,
  useSignOut,
} from "@/features/account/use-account";
import { useAppearance } from "@/features/settings/appearance-provider";

export function SettingsPage() {
  const { theme, setTheme, storageWarning } = useAppearance();
  const account = useAccount();
  const pendingUploads = usePendingUploads();
  const signOut = useSignOut();
  const retryPending = useRetryPendingUploads();

  const accountState = account.data?.state;
  const isSignedIn = accountState === "signed_in";
  const user = account.data?.user;

  const retryError = retryPending.error instanceof Error ? retryPending.error.message : "";
  const pendingError = pendingUploads.data?.error;
  const pendingCount = pendingUploads.data?.count ?? 0;
  const retryNotice = retryPending.data
    ? retryPending.data.error
      ?? (retryPending.data.uploaded > 0
        ? `Saved ${retryPending.data.uploaded} run${retryPending.data.uploaded === 1 ? "" : "s"}. ${retryPending.data.remaining} still waiting.`
        : "")
    : "";

  return <div className="page-container settings-page"><PageHeading eyebrow="Make it your workspace" title="Settings" description="Appearance, your local runner, account, and clear data boundaries." />
    <div className="settings-grid"><aside className="settings-nav" aria-label="Settings sections"><a href="#appearance">Appearance</a><a href="#local-runner">Local runner</a><a href="#account">Account</a><a href="#privacy">Data & privacy</a></aside>
      <div className="settings-sections"><section id="appearance" className="panel settings-section"><h2>Appearance</h2><p>Choose the paper or warm-ink version of the workbench.</p><div className="theme-options" role="group" aria-label="Color theme">
        <button aria-pressed={theme === "light"} onClick={() => setTheme("light")}><div className="theme-swatch theme-light"><span /><span /><span /></div><Sun size={17} />Warm paper</button>
        <button aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}><div className="theme-swatch theme-dark"><span /><span /><span /></div><Moon size={17} />Warm ink</button>
      </div><p className="help-text">Only your appearance preference is stored in this browser. Motion follows your operating system’s reduced-motion preference.</p>{storageWarning && <p role="status" className="field-error">Browser storage is unavailable. The theme applies now but may not survive a reload.</p>}</section>
      <section id="local-runner" className="panel settings-section"><h2><Monitor size={21} />Local runner</h2><p>The local runner sends requests to the target API you configure in the Playground.</p><dl className="detail-list"><div><dt>Default address</dt><dd><code>127.0.0.1:4310</code></dd></div><div><dt>Configuration file</dt><dd><code>do-better.config.json</code></dd></div></dl><div className="command-bar"><code>{'{ "port": 4310 }'}</code><CopyButton value={'{ "port": 4310 }'} /></div><p className="help-text">To change the local UI port, update the configuration file in your launch directory and restart the CLI.</p></section>
      <section id="account" className="panel settings-section"><h2><UserRound size={21} />Account</h2><p>Completed runs save to your account. Target requests execute on this machine.</p>

        {accountState === "checking" && <p className="account-status" role="status">Checking your saved session…</p>}
        {accountState === "unavailable" && <div className="notice notice-error" role="status"><strong>Session check failed.</strong> {account.data?.error} <Button size="sm" variant="ghost" onClick={() => void account.refetch()}>Try again</Button></div>}

        {isSignedIn && <div className="account-summary">
          <div className="account-identity"><strong>{user?.username || "Signed in"}</strong><span>{user?.username}</span></div>
          <span className="quiet-tag text-success">Signed in</span>
        </div>}

        {isSignedIn && <dl className="detail-list account-details">
          <div><dt>Project</dt><dd>{account.data?.projectId ? <code>{shortId(account.data.projectId)}</code> : "Created after your next run"}</dd></div>
        </dl>}

        {isSignedIn && <div className="account-pending">
          <div><h3>Saved runs</h3><p>{pendingUploads.isPending ? "Checking saved runs…" : pendingError ? pendingError : pendingCount === 0 ? "No runs waiting to upload." : `${pendingCount} run${pendingCount === 1 ? "" : "s"} waiting to upload.`}</p></div>
          <Button size="sm" variant="outline" onClick={() => retryPending.mutate()} disabled={retryPending.isPending || pendingCount === 0 || Boolean(pendingError)}>{retryPending.isPending ? "Retrying…" : "Retry uploads"}</Button>
        </div>}
        {(retryNotice || retryError) && <p className="help-text account-note" role="status">{retryError || retryNotice}</p>}

        {isSignedIn && <div className="account-actions">
          <Button variant="outline" onClick={() => signOut.mutate()} disabled={signOut.isPending}>{signOut.isPending ? "Signing out…" : "Sign out"}</Button>
          {signOut.data?.warning && <p className="field-error" role="status">{signOut.data.warning}</p>}
        </div>}

      </section>
      <section id="privacy" className="panel settings-section"><h2><LockKeyhole size={21} />Data & privacy</h2><ul className="privacy-list"><li><strong>Requests execute locally.</strong> Target calls belong to the engine on your computer.</li><li><strong>Payloads stay local.</strong> Request headers and bodies are excluded from master uploads.</li><li><strong>Runs save automatically.</strong> When you are signed in, completed run metrics upload to your account.</li><li><strong>Failed saves wait locally.</strong> Unsaved runs remain in <code>~/.do-better</code> for retry and are never rerun. They contain the target URL and aggregate metrics, not headers or request bodies.</li><li><strong>Response bodies are discarded.</strong> They are consumed for timing and never stored as result content.</li><li><strong>Drafts remain in memory.</strong> Reloading this page clears request payloads and headers. Your session is stored locally and checked with the account service on startup.</li></ul></section>
    </div></div>
  </div>;
}

function shortId(value: string) {
  return value.length > 8 ? value.slice(0, 8) : value;
}
