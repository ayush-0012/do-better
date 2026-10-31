import { LockKeyhole, Monitor, Moon, Sun, UserRound } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { useAppearance } from "@/features/settings/appearance-provider";
import { CopyButton } from "@/components/ui/copy-button";

export function SettingsPage() {
  const { theme, setTheme, storageWarning } = useAppearance();
  return <div className="page-container settings-page"><PageHeading eyebrow="Make it your workspace" title="Settings" description="Appearance, your local runner, and clear data boundaries." />
    <div className="settings-grid"><aside className="settings-nav" aria-label="Settings sections"><a href="#appearance">Appearance</a><a href="#local-runner">Local runner</a><a href="#account">Account</a><a href="#privacy">Data & privacy</a></aside>
      <div className="settings-sections"><section id="appearance" className="panel settings-section"><h2>Appearance</h2><p>Choose the paper or warm-ink version of the workbench.</p><div className="theme-options" role="group" aria-label="Color theme">
        <button aria-pressed={theme === "light"} onClick={() => setTheme("light")}><div className="theme-swatch theme-light"><span /><span /><span /></div><Sun size={17} />Warm paper</button>
        <button aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}><div className="theme-swatch theme-dark"><span /><span /><span /></div><Moon size={17} />Warm ink</button>
      </div><p className="help-text">Only your appearance preference is stored in this browser. Motion follows your operating system’s reduced-motion preference.</p>{storageWarning && <p role="status" className="field-error">Browser storage is unavailable. The theme applies now but may not survive a reload.</p>}</section>
      <section id="local-runner" className="panel settings-section"><h2><Monitor size={21} />Local runner</h2><p>The UI preview is not connected to a runner status endpoint.</p><dl className="detail-list"><div><dt>Connection</dt><dd>Not linked in preview</dd></div><div><dt>Default address</dt><dd><code>127.0.0.1:4310</code></dd></div><div><dt>Configuration file</dt><dd><code>do-better.config.json</code></dd></div></dl><div className="command-bar"><code>{'{ "port": 4310 }'}</code><CopyButton value={'{ "port": 4310 }'} /></div><p className="help-text">Set the port in the configuration file in your launch directory, then restart the CLI. The UI does not modify this file.</p></section>
      <section id="account" className="panel settings-section"><h2><UserRound size={21} />Account</h2><p>Authentication and master-server session integration are not connected to this UI yet.</p><div className="quiet-tag">Not signed in · UI preview</div></section>
      <section id="privacy" className="panel settings-section"><h2><LockKeyhole size={21} />Data & privacy</h2><ul className="privacy-list"><li><strong>Requests execute locally.</strong> Target calls belong to the engine on your computer.</li><li><strong>Payloads stay local.</strong> Request headers and bodies are excluded from master uploads.</li><li><strong>Results can be saved remotely.</strong> The master API accepts run metadata and aggregate metrics. UI uploads remain pending.</li><li><strong>Response bodies are discarded.</strong> They are consumed for timing and never stored as result content.</li><li><strong>Drafts remain in memory.</strong> Reloading this page clears request payloads and headers.</li></ul></section>
    </div></div>
  </div>;
}
