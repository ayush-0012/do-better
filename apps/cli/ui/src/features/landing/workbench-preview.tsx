import { Link } from "@tanstack/react-router";
import { ArrowRight, LockKeyhole, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PatternPreview } from "@/features/playground/pattern-preview";

export function WorkbenchPreview() {
  return <div className="specimen"><div className="specimen-title"><div><p className="eyebrow">Local API testing</p><h3>Playground<span className="heading-mark" /></h3><p>Shape the request. Set the load. See what holds.</p></div><span className="quiet-tag">Design preview</span></div>
    <div className="specimen-grid"><div className="specimen-editor"><div className="request-bar"><span className="method-badge">POST</span><code>http://localhost:8080/api/orders</code></div><div className="specimen-tabs"><strong>Request body</strong><span>Headers</span><span>JSON</span></div>
      <pre aria-label="Example JSON payload"><span className="subtle">1</span>  {"{"}{"\n"}<span className="subtle">2</span>    <span className="syntax-key">"productId"</span>: <span className="syntax-string">"sku_1042"</span>,{"\n"}<span className="subtle">3</span>    <span className="syntax-key">"quantity"</span>: 2,{"\n"}<span className="subtle">4</span>    <span className="syntax-key">"currency"</span>: <span className="syntax-string">"USD"</span>{"\n"}<span className="subtle">5</span>  {"}"}</pre>
      <div className="editor-footer"><LockKeyhole size={13} />Your payload stays on this machine.</div></div>
    <div className="specimen-profile"><h3>Load profile</h3><PatternPreview pattern="constant" /><div className="specimen-segments"><strong>Constant</strong><span>Ramp</span><span>Burst</span><span>Random</span></div><p>Request rate</p><div className="specimen-input"><strong>20</strong><span>req / second</span></div>
      <div className="field-pair"><div><p>Duration</p><div className="specimen-input"><strong>30</strong><span>sec</span></div></div><div><p>Concurrency</p><div className="specimen-input"><strong>10</strong></div></div></div>
      <div className="schedule-summary"><strong>600 requests</strong><p>estimated over 30 seconds</p></div></div></div>
    <div className="specimen-action"><div className="execution-message"><span className="play-tile"><Play size={18} /></span><div><h3>Ready when you are.</h3><p>Requests run from your computer.</p></div></div><Button asChild><Link to="/playground">Open playground<ArrowRight /></Link></Button></div>
  </div>;
}
