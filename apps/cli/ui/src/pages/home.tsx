import { Link } from "@tanstack/react-router";
import { ArrowRight, Gauge, ShieldCheck, Terminal, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { useAccount } from "@/features/account/use-account";
import { WorkbenchPreview } from "@/features/landing/workbench-preview";

export function Home() {
  const signedIn = useAccount().data?.state === "signed_in";
  return <div className="landing-page">
    <div className="landing-hero">
      <section className="landing-section hero hero-grid">
        <div>
          <p className="eyebrow">Local HTTP load testing</p>
          <h1>Load test APIs<br />from your machine<span className="heading-mark" /></h1>
          <p className="hero-description">Build a POST request, choose a traffic pattern, and see how your API responds under load. Sign in to run tests and keep a history of your results.</p>
          <div className="hero-actions">
            <div className="heading-actions">
              <Button asChild size="lg"><Link to={signedIn ? "/overview" : "/sign-in"}>{signedIn ? "Open workspace" : "Sign in"}<ArrowRight /></Link></Button>
              <Button asChild variant="outline" size="lg"><a href="#get-started">CLI quickstart</a></Button>
            </div>
            <p><ShieldCheck size={15} />Request headers and payloads stay on your machine.</p>
          </div>
        </div>
      <div className="report-specimen"><div className="report-specimen-header"><span>Illustrative run</span><span>do-better</span></div><p className="eyebrow">POST /api/orders</p><div className="report-specimen-stat"><strong>600</strong><span>requests completed</span></div><div className="specimen-summary-row"><span>Success</span><strong>99.0%</strong></div><div className="specimen-summary-row"><span>Average latency</span><strong>16.4 ms</strong></div><div className="specimen-summary-row"><span>Stop reason</span><strong>Duration elapsed</strong></div><p className="help-text">Example metrics from a 30-second load test.</p></div>
      </section>
    </div>
    <section className="landing-section" aria-labelledby="workflow-title"><p className="eyebrow">How it works</p><h2 id="workflow-title" className="landing-heading">From request to results</h2>
      <div className="workflow-grid">{[
        { step: "01 / SETUP", icon: Terminal, title: "Configure the request", description: "Set the target, headers, and JSON payload. Choose the request rate, duration, and concurrency.", example: "POST /api/orders" },
        { step: "02 / EXECUTE", icon: Gauge, title: "Run locally", description: "Send a constant stream, ramp up, trigger a burst, or vary the rate. Target requests execute on your machine.", example: "20 req/s · 30 seconds · 10 concurrent" },
        { step: "03 / UNDERSTAND", icon: TrendingUp, title: "Review the results", description: "Inspect HTTP outcomes, latency bounds, and observed throughput. Keep failures and cancellations in perspective.", example: "Min / average / max · HTTP status counts" },
      ].map(({ step, icon: Icon, title, description, example }) => <article className="workflow-card panel" key={step}><div className="section-title"><span className="eyebrow">{step}</span><Icon size={20} /></div><h3>{title}</h3><p>{description}</p><code>{example}</code></article>)}</div>
    </section>
    <section className="landing-section" aria-labelledby="workbench-title">
      <div className="section-heading"><h2 id="workbench-title">Inside the Playground</h2></div>
      <WorkbenchPreview />
    </section>
    <section className="quickstart-section" id="get-started" aria-labelledby="quickstart-title">
      <div className="landing-section quickstart-grid">
        <div>
          <p className="eyebrow">CLI quickstart</p>
          <h2 id="quickstart-title" className="landing-heading">Install and launch</h2>
          <p className="landing-intro"><code>@do-better/cli</code> requires Node.js 22.18 or newer. Install it from the package tarball in the project directory where you want to run tests.</p>
        </div>
        <div className="quickstart-commands">
          {[
            { label: "01 · Install the tarball", command: "npm install /path/to/do-better-cli-0.1.0.tgz" },
            { label: "02 · Start the local UI", command: "npm exec -- do-better start" },
          ].map(({ label, command }) => <div key={label}>
            <h3 className="eyebrow">{label}</h3>
            <div className="command-bar"><code>{command}</code><CopyButton value={command} /></div>
          </div>)}
          <p className="help-text">For sign-in, run the account backend at <code>http://localhost:3000</code> or set <code>apiUrl</code> in <code>do-better.config.json</code> in your launch directory.</p>
          <div className="command-bar"><code>{'{ "apiUrl": "http://localhost:3000" }'}</code><CopyButton value={'{ "apiUrl": "http://localhost:3000" }'} /></div>
        </div>
      </div>
    </section>
  </div>;
}
