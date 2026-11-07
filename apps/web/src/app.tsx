import { useEffect, useState } from "react";
import { Activity, ArrowRight, Code2, Moon, ShieldCheck, Sun } from "lucide-react";
import { CopyCommand } from "./components/copy-command";
import { WorkbenchPreview } from "./components/workbench-preview";

const repository = "https://github.com/ayush-0012/do-better";

export function App() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try { return localStorage.getItem("do-better-web-theme") === "light" ? "light" : "dark"; }
    catch { return "dark"; }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("do-better-web-theme", theme); } catch { /* The selected theme still applies for this visit. */ }
  }, [theme]);

  return <>
    <a href="#main" className="skip-link">Skip to content</a>
    <header className="site-header">
      <div className="header-inner">
        <a className="brand" href="#" aria-label="Do Better home"><Activity className="brand-mark" /><span>Do Better</span></a>
        <nav aria-label="Product navigation">
          <a className="section-link" href="#features">Features</a>
          <a className="section-link" href="#get-started">Quickstart</a>
          <a className="section-link" href="#questions">FAQ</a>
          <button className="theme-button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}>
            {theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
          </button>
          <a className="button small" href="#get-started">Install CLI<ArrowRight size={16} /></a>
        </nav>
      </div>
    </header>
    <main id="main">
      <div className="hero-background">
        <section className="section hero">
          <div>
            <p className="eyebrow">Local HTTP load testing</p>
            <h1>Shape the request.<br />Set the load.<br /><span>See what holds.</span></h1>
            <p className="hero-description">Find out how your API responds when traffic picks up. Run load tests from your machine, explore the results in your browser, and keep a history of every saved run.</p>
            <div className="hero-actions"><a className="button" href="#get-started">Get started<ArrowRight size={17} /></a><a className="button outline" href={repository}><Code2 size={17} />View on GitHub</a></div>
            <CopyCommand command="npm install -g do-better-cli" />
            <p className="privacy-note"><ShieldCheck size={16} />Your target credentials and request bodies stay local.</p>
          </div>
          <div className="report-preview" aria-label="Illustrative load test report">
            <div className="report-top"><span>Example run report</span><span className="completed">Duration elapsed</span></div>
            <p className="eyebrow">POST /api/orders</p>
            <div className="report-total"><strong>600</strong><span>requests completed</span></div>
            <div className="report-row"><span>Succeeded</span><strong>594</strong></div>
            <div className="report-row"><span>Failed</span><strong>6</strong></div>
            <div className="report-row"><span>Average latency</span><strong>16.4 ms</strong></div>
            <div className="report-row"><span>Throughput</span><strong>20 req/s</strong></div>
            <p className="help-text">Illustrative results for a 30-second test.</p>
          </div>
        </section>
      </div>
      <section className="section" id="features">
        <p className="eyebrow">A workbench for your APIs</p>
        <h2>From one request to a traffic profile.</h2>
        <p className="section-description">Configure the request once. Choose how much load to send and inspect what happened.</p>
        <div className="feature-grid">
          {[
            ["01 / CONFIGURE", "Build the request", "Set a POST endpoint, JSON body, and custom headers. Tune rate, duration, and concurrency before starting."],
            ["02 / EXECUTE", "Control the traffic", "Use constant, ramp, burst, or randomized traffic. Requests execute from the local runner on your computer."],
            ["03 / UNDERSTAND", "Read the outcome", "Review HTTP statuses, completed and failed requests, observed throughput, and minimum, average, and maximum latency."],
          ].map(([label, title, description]) => <article className="feature-card" key={title}><p className="eyebrow">{label}</p><h3>{title}</h3><p>{description}</p></article>)}
        </div>
      </section>
      <section className="section preview-section" aria-labelledby="playground-title">
        <p className="eyebrow">Inside the app</p><h2 id="playground-title">A clearer way to test.</h2>
        <p className="section-description">The Playground opens locally after you start the CLI and sign in.</p>
        <WorkbenchPreview />
      </section>
      <section className="section quickstart-grid" id="get-started">
        <div><p className="eyebrow">CLI quickstart</p><h2>Install. Launch.<br />Run your first test.</h2><p className="section-description">Install <code>do-better-cli</code> with npm. You need Node.js 22.18 or newer, a browser, and an API you control.</p><a className="text-link" href="https://www.npmjs.com/package/do-better-cli">View the npm package<ArrowRight size={16} /></a></div>
        <ol className="setup-steps">
          <li><h3><span>01</span>Install globally</h3><CopyCommand command="npm install -g do-better-cli" /></li>
          <li><h3><span>02</span>Start the local workspace</h3><CopyCommand command="do-better start" /><p>The CLI opens your browser at <code>http://127.0.0.1:4310</code>. Keep the terminal running while you test.</p></li>
          <li><h3><span>03</span>Sign in and configure a test</h3><p>Create an account or sign in. Open Playground, enter your target URL and request body, then choose a load profile.</p></li>
          <li><h3><span>04</span>Review and save</h3><p>Choose Run test. Inspect the report and revisit saved results from History. Press Ctrl+C in your terminal when you’re done.</p></li>
        </ol>
      </section>
      <section className="data-section"><div className="section data-grid">
        <div><p className="eyebrow">Your data</p><h2>Local requests.<br />A history you can return to.</h2></div>
        <div>
          <article><ShieldCheck size={22} /><div><h3>Keep request details on your machine</h3><p>Target headers and request bodies stay with the local runner. Response bodies are consumed for timing and then discarded.</p></div></article>
          <article><Activity size={22} /><div><h3>Save the measurements</h3><p>Signed-in runs save the target URL, load settings, and aggregate metrics to your account. Search your saved runs, open reports, and export the current history page.</p></div></article>
          <article><ArrowRight size={22} /><div><h3>Retry a save</h3><p>If an upload fails, retry it from the report or Settings. The retry saves the result without sending another load test.</p></div></article>
        </div>
      </div></section>
      <section className="section faq" id="questions"><p className="eyebrow">Before you run</p><h2>A few practical details.</h2>
        {[
          ["Do I need an account?", "Yes. Start the CLI, then create an account or sign in to access the Playground, Overview, History, and Settings."],
          ["Which requests can I test?", "The current runner sends POST requests with optional JSON bodies and custom headers. Use a target you control and supply the body and authentication it expects."],
          ["What happens when the API returns an error?", "HTTP 2xx responses count as successes. Other HTTP statuses count as failures. HTTP 500 or a network error stops the run early. The report includes a breakdown of HTTP statuses."],
          ["What do the measurements include?", "Latency includes reading the response body. The report shows minimum, average, and maximum latency. Requests may be skipped when the concurrency limit is reached. Percentiles and time-series measurements are not collected."],
          ["Can I reopen a previous test?", "Yes. History lists saved runs and can load their settings into the Playground. Enter request headers and bodies again because saved reports exclude those details."],
          ["What if the browser does not open?", "Visit the local URL printed in your terminal. The default is http://127.0.0.1:4310. Keep the CLI running while you use the workspace."],
        ].map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
      </section>
    </main>
    <footer className="site-footer"><div><a className="brand" href="#"><Activity size={22} /><span>Do Better</span></a><p>Built for local API testing.</p></div><nav aria-label="Resources"><a href={repository}>GitHub</a><a href="https://www.npmjs.com/package/do-better-cli">npm</a><a href={`${repository}/blob/main/apps/cli/README.md`}>Documentation</a></nav></footer>
  </>;
}
