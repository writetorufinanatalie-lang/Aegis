import { useEffect, useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiFetch, IS_MOCK_MODE } from "./lib/api";

const BUSINESS_KEY_STORAGE = "aegis-business-key"; // deliberately separate from "aegis-session" (worker auth)

const mockSummary: any = {
  portfolio_size: 240,
  provenance: "SYNTHETIC DEMO PORTFOLIO — anonymized and aggregated only; no individual worker profile, transaction, or identifying field exists in this dataset or response.",
  average_resilience_score: 48.1,
  average_runway_days: 16.7,
  resilience_band_distribution: { Fragile: { count: 33, pct: 13.8 }, Vulnerable: { count: 63, pct: 26.2 }, Building: { count: 132, pct: 55.0 }, Resilient: { count: 12, pct: 5.0 } },
  repayment_risk_distribution: { LOW: { count: 32, pct: 13.3 }, MEDIUM: { count: 124, pct: 51.7 }, HIGH: { count: 84, pct: 35.0 } },
  weather_exposure_distribution: { LOW: { count: 86, pct: 35.8 }, MEDIUM: { count: 141, pct: 58.8 }, HIGH: { count: 13, pct: 5.4 } },
  by_work_type: { Delivery: { count: 50, average_resilience: 44.2 }, Driving: { count: 43, average_resilience: 49.4 }, "Domestic work": { count: 44, average_resilience: 51.4 }, Retail: { count: 40, average_resilience: 44.6 }, Freelance: { count: 63, average_resilience: 50.3 } },
  aggregate_safe_lending_capacity: 965393,
  pct_needing_intervention: 40.0
};
const mockModelInfo: any = { name: "Repayment-risk classifier", algorithm: "GradientBoostingClassifier (scikit-learn)", holdout_accuracy: 0.745, holdout_auc: 0.813, holdout_rows: 800, trained_on: "3,200 synthetic rows, retrained fresh at server start", cross_validation: { folds: 5, accuracy_mean: 0.75, accuracy_std: 0.015, auc_mean: 0.817, auc_std: 0.009 }, feature_importance: [{ feature: "financial_runway_days", importance: 0.77 }, { feature: "income_volatility_score", importance: 0.071 }, { feature: "debt_burden_pct", importance: 0.057 }, { feature: "weather_disruption_pct", importance: 0.053 }, { feature: "savings_rate_pct", importance: 0.049 }], disclosure: "A genuinely trained model, trained on synthetic data for this MVP, not real repayment outcomes. Both a held-out test score and 5-fold cross-validation are reported so the accuracy figure is statistically defensible." };

const money = (value: number) => `₹${Math.round(value || 0).toLocaleString("en-IN")}`;
const tone = (label: string): "green" | "amber" | "red" => (label === "LOW" || label === "Resilient" ? "green" : label === "HIGH" || label === "Fragile" ? "red" : "amber");

export default function Business({ onExit }: { onExit: () => void }) {
  const [key, setKey] = useState(localStorage.getItem(BUSINESS_KEY_STORAGE) || "");
  const [demoKey, setDemoKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [modelInfo, setModelInfo] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (IS_MOCK_MODE) { setDemoKey("aegis-demo-lender-key-2026"); return; }
    apiFetch<any>("/api/business/demo-key").then(response => setDemoKey(response.demo_api_key)).catch(() => setError("Could not reach the business API. Either the backend isn't running, or it's running an older version started before this endpoint existed — stop and restart the backend server to pick up the latest code."));
  }, []);

  const enter = async () => {
    setBusy(true); setError("");
    try {
      if (IS_MOCK_MODE) {
        if (key.trim() === "") throw new Error("Enter the demo API key shown above.");
        setSummary(mockSummary); setModelInfo(mockModelInfo); setAuthed(true); localStorage.setItem(BUSINESS_KEY_STORAGE, key);
        return;
      }
      const [summaryResponse, modelResponse] = await Promise.all([
        apiFetch<any>("/api/business/portfolio-summary", { headers: { "X-AEGIS-Business-Key": key } }),
        apiFetch<any>("/api/business/model-info", { headers: { "X-AEGIS-Business-Key": key } })
      ]);
      setSummary(summaryResponse); setModelInfo(modelResponse); setAuthed(true); localStorage.setItem(BUSINESS_KEY_STORAGE, key);
    } catch (err: any) {
      setError(err?.message || "That API key was not accepted. Check the key and try again.");
      setAuthed(false);
    } finally {
      setBusy(false);
    }
  };

  if (!authed) {
    return <div className="entry-screen">
      <div className="entry-orb entry-orb-a" /><div className="entry-orb entry-orb-b" /><div className="entry-orb entry-orb-c" />
      <section className="entry-panel">
        <div className="eyebrow">AEGIS / BUSINESS &amp; LENDER PORTAL</div>
        <h1>Portfolio-level resilience insight, without any individual worker's data.</h1>
        <p>This is a separate login from the worker app — a different credential, a different API, and a dataset that is aggregated by construction, never per-worker.</p>
        {error && <p className="notice" role="alert">{error}</p>}
        <label className="field-label">BUSINESS API KEY</label>
        <input value={key} onChange={event => setKey(event.target.value)} placeholder={demoKey || "Loading demo key…"} />
        {demoKey && <small>Demo key auto-filled for judges: <code>{demoKey}</code> — click below, or paste it into the field above.</small>}
        <div className="survey-actions">
          <button className="secondary" onClick={onExit}>← Back to worker app</button>
          <button className="primary" onClick={() => { if (!key && demoKey) setKey(demoKey); enter(); }} disabled={busy}>{busy ? "Verifying key…" : "Enter portfolio view"}</button>
        </div>
      </section>
    </div>;
  }

  const bandData = Object.entries(summary.resilience_band_distribution).map(([label, value]: any) => ({ label, pct: value.pct, fill: tone(label) === "green" ? "#10b981" : tone(label) === "red" ? "#ef4444" : "#f59e0b" }));
  const riskData = Object.entries(summary.repayment_risk_distribution).map(([label, value]: any) => ({ label, pct: value.pct, fill: tone(label) === "green" ? "#10b981" : tone(label) === "red" ? "#ef4444" : "#f59e0b" }));
  const workTypeData = Object.entries(summary.by_work_type).map(([label, value]: any) => ({ label, resilience: value.average_resilience, count: value.count }));

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark" /><div><strong>AEGIS</strong><span>BUSINESS PORTAL</span><small>Aggregate portfolio analytics</small></div></div>
      <p className="fine" style={{ padding: "0 20px" }}>Logged in with a business API key — structurally separate from any worker session. No individual worker record is ever exposed through this view.</p>
      <div className="side-status" style={{ marginTop: "auto" }}>
        <label>DATA STATUS</label>
        <p>Portfolio<br /><b>{summary.portfolio_size} SYNTHETIC RECORDS</b></p>
        <p>Identifying fields<br /><b>NONE COLLECTED</b></p>
      </div>
    </aside>
    <div className="main-shell">
      <header><div><strong>AEGIS</strong><span>Business &amp; lender portal</span></div><div className="header-actions"><button onClick={() => { localStorage.removeItem(BUSINESS_KEY_STORAGE); setAuthed(false); }}>Log out</button><button onClick={onExit}>Worker app →</button></div></header>
      <main>
        <div className="page">
          <section className="decision decision-blue">
            <div>
              <div className="eyebrow">PORTFOLIO OVERVIEW</div>
              <h1>{summary.portfolio_size} workers</h1>
              <p>{summary.provenance}</p>
            </div>
            <div className="decision-grid">
              <Metric label="Average resilience" value={`${summary.average_resilience_score}/100`} note="portfolio-wide" />
              <Metric label="Average runway" value={`${summary.average_runway_days} days`} note="essential expenses covered" />
              <Metric label="Safe aggregate lending capacity" value={money(summary.aggregate_safe_lending_capacity)} note="across LOW/MEDIUM-risk workers only" />
            </div>
          </section>

          <div className="two">
            <section className="panel">
              <div className="panel-head"><label>RESILIENCE BAND DISTRIBUTION</label><b>PORTFOLIO %</b></div>
              <ResponsiveContainer width="100%" height={200}><BarChart data={bandData} layout="vertical" margin={{ left: 8, right: 24 }}><XAxis type="number" domain={[0, 100]} hide /><YAxis type="category" dataKey="label" width={80} tickLine={false} axisLine={false} /><Tooltip formatter={(value: any) => `${value}%`} /><Bar dataKey="pct" isAnimationActive>{bandData.map((entry, index) => <Cell key={index} fill={entry.fill} stroke="#111827" strokeWidth={2} />)}</Bar></BarChart></ResponsiveContainer>
              <p className="fine">Fragile/Vulnerable/Building/Resilient — the same ladder shown to individual workers, aggregated here.</p>
            </section>
            <section className="panel">
              <div className="panel-head"><label>REPAYMENT RISK DISTRIBUTION</label><b>ML-ASSISTED</b></div>
              <ResponsiveContainer width="100%" height={200}><BarChart data={riskData} layout="vertical" margin={{ left: 8, right: 24 }}><XAxis type="number" domain={[0, 100]} hide /><YAxis type="category" dataKey="label" width={80} tickLine={false} axisLine={false} /><Tooltip formatter={(value: any) => `${value}%`} /><Bar dataKey="pct" isAnimationActive>{riskData.map((entry, index) => <Cell key={index} fill={entry.fill} stroke="#111827" strokeWidth={2} />)}</Bar></BarChart></ResponsiveContainer>
              <p className="fine">{summary.pct_needing_intervention}% of the portfolio has under 14 days of runway and may need proactive outreach.</p>
            </section>
          </div>

          <section className="panel">
            <div className="panel-head"><label>AVERAGE RESILIENCE BY WORK TYPE</label><b>AGGREGATE ONLY</b></div>
            <ResponsiveContainer width="100%" height={200}><BarChart data={workTypeData}><XAxis dataKey="label" tickLine={false} axisLine={false} /><YAxis domain={[0, 100]} tickLine={false} axisLine={false} /><Tooltip formatter={(value: any, name: any) => name === "resilience" ? `${value}/100` : value} /><Bar dataKey="resilience" fill="#4f46e5" stroke="#111827" strokeWidth={2} isAnimationActive /></BarChart></ResponsiveContainer>
            <p className="fine">Cohort averages only — never a list of individual workers or their work type.</p>
          </section>

          {modelInfo && <section className="panel">
            <div className="panel-head"><label>UNDERLYING ML MODEL</label><b>{modelInfo.algorithm}</b></div>
            <p>{modelInfo.disclosure}</p>
            <div className="four">
              <Metric label="Holdout accuracy" value={`${Math.round(modelInfo.holdout_accuracy * 100)}%`} />
              <Metric label="Holdout AUC" value={modelInfo.holdout_auc} />
              <Metric label="Trained on" value={modelInfo.trained_on} />
              <Metric label="Holdout rows" value={modelInfo.holdout_rows} />
            </div>
            {modelInfo.cross_validation && <div className="four" style={{ marginTop: "4px" }}>
              <Metric label={`${modelInfo.cross_validation.folds}-fold CV accuracy`} value={`${Math.round(modelInfo.cross_validation.accuracy_mean * 100)}% ± ${Math.round(modelInfo.cross_validation.accuracy_std * 100)}`} note="mean ± std" />
              <Metric label={`${modelInfo.cross_validation.folds}-fold CV AUC`} value={`${modelInfo.cross_validation.auc_mean} ± ${modelInfo.cross_validation.auc_std}`} note="mean ± std" />
            </div>}
            {modelInfo.feature_importance && <>
              <div className="panel-head" style={{ marginTop: "16px" }}><label>FEATURE IMPORTANCE</label><b>MODEL EXPLAINABILITY</b></div>
              {modelInfo.feature_importance.map((item: any) => <div className="breakdown" key={item.feature}><span>{item.feature.replace(/_/g, " ")}</span><Meter value={item.importance * 100} /><b>{Math.round(item.importance * 100)}%</b></div>)}
            </>}
          </section>}
        </div>
      </main>
    </div>
  </div>;
}

function Metric({ label, value, note }: { label: string; value: any; note?: string }) { return <div className="metric"><label>{label}</label><strong>{value}</strong>{note && <small>{note}</small>}</div>; }
function Meter({ value }: { value: number }) { return <div className="meter"><i style={{ width: `${value}%` }} /></div>; }
