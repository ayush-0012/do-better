import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Gauge, PlayCircle, ShieldCheck, Terminal, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { WorkbenchPreview } from "@/features/landing/workbench-preview";

export function Home() {
  return <div className="landing-page">
    <section className="landing-section hero"><p className="eyebrow"><span className="preview-square" />Precision. From your own machine.</p>
      <div className="hero-grid"><div><h1>Shape the request.<br />Set the load.<br /><span>See what holds.</span><span className="heading-mark" /></h1>
        <p className="hero-description">Put your APIs through their paces. Configure a request, run a load profile locally, and turn the results into something you can act on.</p></div>
        <div className="hero-actions"><div className="heading-actions"><Button asChild size="lg"><a href="#get-started">Get started<ArrowRight /></a></Button><Button asChild variant="outline" size="lg"><Link to="/playground"><PlayCircle />Explore playground</Link></Button></div><p><ShieldCheck size={14} />Target credentials and payloads stay local.</p></div></div>
      <div className="command-bar"><span className="terminal-prompt" aria-hidden="true">$</span><code>do-better start</code><CopyButton value="do-better start" /></div>
    </section>
    <section className="landing-section" aria-labelledby="workbench-title"><div className="section-heading"><div><p className="eyebrow">Interactive specimen</p><h2 id="workbench-title">The local workbench</h2></div><span className="help-text">Designed for a clearer feedback loop.</span></div><WorkbenchPreview /></section>
    <section className="landing-section" aria-labelledby="workflow-title"><p className="eyebrow">Workflow architecture</p><h2 id="workflow-title" className="landing-heading">Three steps. A clearer picture.</h2><p className="landing-intro">Less setup between a question and a useful result.</p>
      <div className="workflow-grid">{[
        { step: "01 / SETUP", icon: Terminal, title: "Configure the request", description: "Set the target, headers, and JSON payload. Choose the request rate, duration, and concurrency.", example: "POST /api/orders" },
        { step: "02 / EXECUTE", icon: Gauge, title: "Run locally", description: "Send a constant stream, ramp up, trigger a burst, or vary the rate. Target requests execute on your machine.", example: "20 req/s · 30 seconds · 10 concurrent" },
        { step: "03 / UNDERSTAND", icon: TrendingUp, title: "Review the results", description: "Inspect HTTP outcomes, latency bounds, and observed throughput. Keep failures and cancellations in perspective.", example: "Min / average / max · HTTP status counts" },
      ].map(({ step, icon: Icon, title, description, example }) => <article className="workflow-card panel" key={step}><div className="section-title"><span className="eyebrow">{step}</span><Icon size={20} /></div><h3>{title}</h3><p>{description}</p><code>{example}</code></article>)}</div>
    </section>
    <section className="precision-section"><div className="landing-section precision-grid"><div><p className="eyebrow">Built for engineers</p><h2 className="landing-heading">Thoughtful instruments.<br />Useful answers.</h2><p className="landing-intro">A focused workflow for the APIs you build, with clear boundaries around the data you send.</p>
      <ul className="principle-list"><li><CheckCircle2 /><div><h3>Local target execution</h3><p>Headers and payloads stay with the local runner.</p></div></li><li><CheckCircle2 /><div><h3>Explicit stop conditions</h3><p>Execution stops on HTTP 500 or network errors.</p></div></li><li><CheckCircle2 /><div><h3>Metrics with context</h3><p>Timings include consuming the response body.</p></div></li></ul></div>
      <div className="report-specimen"><div className="report-specimen-header"><span>Example run summary</span><span>do-better</span></div><p className="eyebrow">POST /api/orders</p><div className="report-specimen-stat"><strong>600</strong><span>requests completed</span></div><div className="specimen-summary-row"><span>Success</span><strong>99.0%</strong></div><div className="specimen-summary-row"><span>Average latency</span><strong>16.4 ms</strong></div><div className="specimen-summary-row"><span>Stop reason</span><strong>Duration elapsed</strong></div><p className="help-text">Illustrative data, not a live measurement.</p></div>
    </div></section>
    <section className="landing-section" id="get-started"><div className="getting-started"><span className="heading-mark" aria-hidden="true" /><h2>Bring your next API<br />into the workbench.</h2><p>The local UI is taking shape. Explore the screens while request execution and master integration are being connected.</p><Button asChild size="lg"><Link to="/playground">Open playground<ArrowRight /></Link></Button><div className="command-bar"><code>do-better start</code><CopyButton value="do-better start" /></div><p className="help-text">npm installation and publishing are coming later. No public install command is available yet.</p></div></section>
  </div>;
}
