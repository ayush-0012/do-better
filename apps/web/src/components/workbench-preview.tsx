import { useState } from "react";

const profiles = [
  { name: "Constant", path: "M0 10 H300", description: "A steady 20 requests per second throughout the run." },
  { name: "Ramp", path: "M0 64 L300 10", description: "Gradually increases from 2 to 20 requests per second over 30 seconds." },
  { name: "Burst", path: "M0 64 H50 V16 H300", description: "Starts at 2 requests per second, then jumps to 18 after 5 seconds." },
  {
    name: "Random",
    // A fixed sample keeps this illustrative preview stable between selections.
    path: "M0 46 H10 V22 H20 V58 H30 V34 H40 V16 H50 V52 H60 V28 H70 V40 H80 V12 H90 V60 H100 V36 H110 V24 H120 V48 H130 V18 H140 V54 H150 V30 H160 V42 H170 V14 H180 V56 H190 V26 H200 V38 H210 V20 H220 V62 H230 V32 H240 V44 H250 V10 H260 V50 H270 V28 H280 V58 H290 V22 H300",
    description: "Changes every second between 2 and 20 requests per second. One illustrative sample is shown.",
  },
] as const;

export function WorkbenchPreview() {
  const [selectedProfile, setSelectedProfile] = useState<(typeof profiles)[number]>(profiles[0]);
  return <div className="workbench">
    <div className="workbench-header">
      <div><p className="eyebrow">Local API testing</p><h3>Playground</h3></div>
      <span className="preview-label">Product preview</span>
    </div>
    <div className="workbench-grid">
      <div className="request-preview">
        <div className="request-url"><span className="method-badge">POST</span><code>http://localhost:8080/api/orders</code></div>
        <div className="editor-label">Request body <span>JSON</span></div>
        <pre aria-label="Example request body">{'{\n  "sku": "MUG-001",\n  "quantity": 2\n}'}</pre>
        <p className="help-text">An illustrative request. Use the fields your API expects.</p>
      </div>
      <div className="load-preview">
        <h3>Load profile</h3>
        <svg viewBox="0 0 300 70" preserveAspectRatio="none" role="img" aria-label={`${selectedProfile.name} load profile. ${selectedProfile.description}`}>
          <path d={`${selectedProfile.path} L300 70 L0 70 Z`} fill="currentColor" opacity=".08" />
          <path d={selectedProfile.path} fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
        <div className="profile-options" role="group" aria-label="Preview a load profile">
          {profiles.map((profile) => <button key={profile.name} type="button" aria-pressed={selectedProfile.name === profile.name} onClick={() => setSelectedProfile(profile)}>{profile.name}</button>)}
        </div>
        <p className="help-text profile-description" aria-live="polite">{selectedProfile.description}</p>
        <dl><div><dt>Request rate</dt><dd>20 req/s</dd></div><div><dt>Duration</dt><dd>30 seconds</dd></div><div><dt>Concurrency</dt><dd>10</dd></div></dl>
      </div>
    </div>
  </div>;
}
