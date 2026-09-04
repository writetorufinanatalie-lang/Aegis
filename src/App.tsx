import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, Cell, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiFetch, IS_MOCK_MODE } from "./lib/api";
import { evaluateSchemes, type EligibilityResult } from "./lib/schemes";
import { useHashRoute } from "./lib/router";

type Page = "overview" | "income" | "resilience" | "monitor" | "models" | "simulator" | "borrowing" | "guidance" | "schemes" | "alerts" | "privacy" | "profile";
const PAGES: Page[] = ["overview", "income", "resilience", "monitor", "models", "simulator", "borrowing", "guidance", "schemes", "alerts", "privacy", "profile"];

const fallback: any = {
  worker: { worker_id: "W001", work_type: "Delivery", operating_area: "Chennai", income_frequency: "Weekly", primary_platform: "Delivery platform" },
  intelligence: { average_income: 27750, median_income: 26500, essential_expenses: 21000, discretionary_expenses: 2500, cash_flow_surplus: 30450, savings_rate_pct: 37, income_volatility: .37, financial_runway_days: 11, emergency_buffer: 8000 },
  resilience: { score: 61, ladder: "Building", financial_runway_days: 11, target_runway_days: 30, breakdown: { "Income Stability": 55, "Emergency Buffer": 38, "Cash-Flow Strength": 72, "Debt Burden": 61, "Weather Resilience": 60 } },
  safe_to_save: 500, safe_to_borrow: { credit_requested: 80000, safe_borrowing_capacity: 35000, emi: 7230, repayment_risk: "LOW", decision: "CONSIDER ONLY IF ESSENTIAL" },
  climate: { risk: "MEDIUM", work_disruption_pct: 15, possible_income_impact: 4200, conditions: "Weather may reduce working hours.", source: "DEMO FALLBACK", confidence: .35 },
  models: { disclosure: "Three explainable heuristic models plus one genuinely trained ML classifier for this MVP. The heuristics are not machine-learning models or credit scores; the classifier is real but trained on synthetic data, not real repayment outcomes.", income_volatility: { name: "Income stability model", method: "deterministic heuristic", inputs: ["weekly earnings", "income variation"], confidence: .7 }, work_disruption: { name: "Weather-to-work disruption model", method: "forecast-to-impact heuristic", inputs: ["72-hour forecast", "work type"], confidence: .35 }, repayment_resilience: { name: "Repayment resilience model", method: "deterministic affordability heuristic", inputs: ["runway", "debt burden", "weather disruption"], confidence: .65 }, ml_repayment_risk: { name: "Repayment-risk classifier", method: "GradientBoostingClassifier (scikit-learn)", inputs: ["income_volatility_score", "financial_runway_days", "debt_burden_pct", "weather_disruption_pct", "savings_rate_pct"], confidence: .81, trained_on: "3,200 synthetic rows, retrained fresh at server start", holdout_accuracy: .745, holdout_auc: .813, cross_validation: { folds: 5, accuracy_mean: .75, accuracy_std: .015, auc_mean: .817, auc_std: .009 }, feature_importance: [{ feature: "financial_runway_days", importance: .77 }, { feature: "income_volatility_score", importance: .071 }, { feature: "debt_burden_pct", importance: .057 }, { feature: "weather_disruption_pct", importance: .053 }, { feature: "savings_rate_pct", importance: .049 }] } },
  ml: { income_volatility: { level: "HIGH" }, income_recovery: { expected_recovery_weeks: 3 } },
  decision: { primary_action: "PROTECT CASH", explanation: "Your runway is 11 days and income has been uneven this month. Preserve essential liquidity.", next_check: "in 7 days" },
  recommendations: [{ when: "TODAY", text: "Reserve ₹500 for fuel and food before discretionary spending." }, { when: "NEXT 72 HOURS", text: "Plan for possible work disruption." }, { when: "THIS WEEK", text: "Avoid high-cost credit unless it protects essential work or housing." }, { when: "CHECK AGAIN", text: "Update earnings after the next payout." }],
  weekly_income_series: [{ week: "Week 1", amount: 18000 }, { week: "Week 2", amount: 31000 }, { week: "Week 3", amount: 22000 }, { week: "Week 4", amount: 40000 }],
  income_forecast: { method: "Linear trend (ordinary least squares) over recent weekly income", forecast_next_week: 34000, range_low: 24000, range_high: 44000, trend: "STABLE", confidence_note: "80% range assuming the recent trend continues; a real income shock is not predicted by this model." },
  alerts: [{ level: "WARNING", title: "Cash runway below two weeks", text: "11 days of runway remain. Avoid new borrowing this week." }],
  trace: ["Synthetic income history", "Income stability model", "Weather-to-work disruption model", "Repayment resilience model", "ML repayment-risk classifier", "Runway and essential expenses", "PROTECT CASH"],
  disclosure: "Financial inputs are synthetic demo data. This is not lending, insurance, or financial advice."
};

const navGroups: { title: string; pages: [Page, string][] }[] = [
  { title: "MONITOR", pages: [["overview", "This week's decision"], ["income", "Income and spending"], ["monitor", "72-hour work monitor"]] },
  { title: "PLAN", pages: [["guidance", "Action plan"], ["simulator", "Income shock simulator"], ["borrowing", "Safe borrowing"], ["schemes", "Government scheme finder"]] },
  { title: "UNDERSTAND", pages: [["resilience", "Resilience analysis"], ["models", "How AEGIS works"], ["alerts", "Alerts and history"]] },
  { title: "ACCOUNT", pages: [["profile", "Financial profile"], ["privacy", "Privacy and consent"]] }
];

const money = (value: number) => `₹${Math.round(value || 0).toLocaleString("en-IN")}`;
// Sourced from the worker's actual session transactions via data.weekly_income_series (backend-computed),
// with a static fallback only for the very first mock-mode render before any session data has loaded.
const weeklyIncome = (data: any) => {
  const median = data.intelligence?.median_income || 26500;
  const series = Array.isArray(data.weekly_income_series) && data.weekly_income_series.length ? data.weekly_income_series : [18000, 31000, 22000, 40000].map((amount, index) => ({ week: `Week ${index + 1}`, amount }));
  return series.map((item: any) => ({ week: item.week, amount: item.amount, low: item.amount < median }));
};

function downloadSummary(data: any) {
  const lines = [
    "AEGIS — this week's summary",
    `Generated ${new Date().toLocaleString("en-IN")}`,
    "",
    `Decision: ${data.decision.primary_action}`,
    data.decision.explanation,
    "",
    `Resilience score: ${data.resilience.score}/100 (${data.resilience.ladder})`,
    `Safe to save this week: ${money(data.safe_to_save)}`,
    `Safe borrowing capacity: ${money(data.safe_to_borrow.safe_borrowing_capacity)} — ${data.safe_to_borrow.decision}`,
    `72-hour work monitor: ${data.climate.risk} risk, ${data.climate.work_disruption_pct}% potential disruption (${data.climate.source})`,
    "",
    "Action plan:",
    ...data.recommendations.map((item: any) => `- [${item.when}] ${item.text}`),
    "",
    data.disclosure
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = "aegis-weekly-summary.txt"; link.click();
  URL.revokeObjectURL(url);
}

/** Eases a displayed number toward `value` instead of jumping, so score changes after a
 * simulation or reload are readable rather than an instant flicker. */
function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now(); const startValue = from.current; const duration = 550;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(startValue + (value - startValue) * eased);
      if (t < 1) frame = requestAnimationFrame(tick); else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{display.toFixed(decimals)}</>;
}

export default function App({ onOpenBusiness }: { onOpenBusiness: () => void }) {
  const [page, setPage] = useHashRoute<Page>(PAGES, "overview");
  const [data, setData] = useState(fallback);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [trace, setTrace] = useState(false);
  const [loggedIn, setLoggedIn] = useState(Boolean(localStorage.getItem("aegis-session")));
  const [onboarded, setOnboarded] = useState(localStorage.getItem("aegis-onboarded") === "true");
  const notify = (kind: "success" | "error", text: string) => setToast({ kind, text });
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 4000); return () => clearTimeout(timer); }, [toast]);
  const load = async () => { if (!IS_MOCK_MODE) try { setData(await apiFetch<any>("/api/decision")); setMessage(""); } catch { setMessage("Live analysis is unavailable. Showing clearly labelled synthetic demo data."); } };
  useEffect(() => { if (loggedIn && onboarded) load(); }, [loggedIn, onboarded]);
  useEffect(() => { if (!trace) return; const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setTrace(false); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [trace]);
  const logout = async () => {
    if (!IS_MOCK_MODE) { try { await apiFetch("/api/auth/logout", { method: "POST" }); } catch { /* token is invalidated locally regardless */ } }
    localStorage.removeItem("aegis-session"); localStorage.removeItem("aegis-onboarded"); setLoggedIn(false); setOnboarded(false); window.location.hash = "";
  };
  if (!loggedIn) return <Login onLogin={() => setLoggedIn(true)} onOpenBusiness={onOpenBusiness} />;
  if (!onboarded) return <Survey onDone={() => { localStorage.setItem("aegis-onboarded", "true"); setOnboarded(true); }} />;
  if (page === "not-found") return <NotFound onHome={() => setPage("overview")} />;
  return <div className="app-shell">
    <Sidebar page={page} setPage={setPage} data={data} />
    <div className="main-shell">
      <header><div><strong>AEGIS</strong><span>Worker financial resilience</span></div><div className="header-actions"><span className={`pulse-dot pulse-${data.climate.source.includes("LIVE") ? "green" : "amber"}`} /><span className="source-label">{data.climate.source}</span><button onClick={() => downloadSummary(data)}>Download summary</button><button onClick={logout}>Log out</button></div></header>
      {message && <p className="notice" role="alert">{message}</p>}
      <main id="main-content"><Content page={page} data={data} reload={load} openTrace={() => setTrace(true)} notify={notify} /></main>
    </div>
    {trace && <Trace data={data} close={() => setTrace(false)} />}
    {toast && <div className={`toast toast-${toast.kind}`} role="status">{toast.text}</div>}
  </div>;
}

function NotFound({ onHome }: { onHome: () => void }) {
  return <div className="entry-screen">
    <section className="entry-panel">
      <div className="eyebrow">AEGIS / 404</div>
      <h1>This page doesn't exist.</h1>
      <p>The link may be out of date, or the page was mistyped. Nothing in your session was affected.</p>
      <button className="primary" onClick={() => { window.location.hash = "/overview"; onHome(); }}>Back to this week's decision</button>
    </section>
  </div>;
}

function Login({ onLogin, onOpenBusiness }: { onLogin: () => void; onOpenBusiness: () => void }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const start = async () => { setBusy(true); try { const result = IS_MOCK_MODE ? { authenticated: true, session: "local-demo" } : await apiFetch<any>("/api/auth/login", { method: "POST", body: JSON.stringify({ worker_id: "W001", password: "demo123" }) }); if (!result.authenticated) throw new Error(); localStorage.setItem("aegis-session", result.session); onLogin(); } catch { setError("A secure demo session could not be started. Please try again."); } finally { setBusy(false); } };
  return <div className="entry-screen"><div className="entry-orb entry-orb-a" /><div className="entry-orb entry-orb-b" /><div className="entry-orb entry-orb-c" /><section className="entry-panel"><div className="eyebrow">AEGIS / PRIVATE DEMO</div><h1>Make the next money decision with more confidence.</h1><p>See how changing income and weather conditions affect a worker's short-term resilience. No banking credentials are requested.</p><div className="pillar-row"><span className="pillar">UNDERSTAND</span><span className="pillar-arrow">→</span><span className="pillar">PLAN</span><span className="pillar-arrow">→</span><span className="pillar">PROTECT</span></div>{error && <p className="notice" role="alert">{error}</p>}<button className="primary" onClick={start} disabled={busy}>{busy ? "Starting secure session" : "Start secure demo"}</button><small>Your session uses synthetic information. Nothing is shared with employers, platforms, lenders, or other businesses.</small><button type="button" className="text-button entry-business-link" onClick={onOpenBusiness}>Business &amp; lender portal →</button></section></div>;
}

const questions = [
  { key: "work_type", label: "What kind of work do you do?", options: ["Delivery", "Driving", "Domestic work", "Retail", "Freelance"] },
  { key: "operating_area", label: "Which city or area do you mainly work in?", options: ["Chennai", "Bengaluru", "Mumbai", "Delhi"] },
  { key: "income_frequency", label: "How often do you receive income?", options: ["Daily", "Weekly", "Monthly", "It varies"] },
  { key: "income_predictability", label: "How predictable is your income?", options: ["Usually predictable", "Sometimes variable", "Very variable"] },
  { key: "income_sources", label: "How many income sources do you have?", options: ["1", "2", "3 or more"] },
  { key: "essential_monthly_expenses", label: "What are your essential monthly expenses?", type: "number", hint: "Rent, food, transport, bills and family essentials" },
  { key: "current_savings", label: "How much can you access in savings today?", type: "number" },
  { key: "existing_emi", label: "What is your monthly EMI or debt repayment?", type: "number" },
  { key: "financial_goal", label: "What would you like to improve first?", options: ["Emergency fund", "Stable weekly spending", "Reduce debt", "Plan a necessary purchase"] },
  { key: "borrowing_comfort", label: "When would borrowing feel acceptable to you?", options: ["Only for essentials", "For work equipment", "Only after planning", "I prefer not to borrow"] }
];

function Survey({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0); const [other, setOther] = useState(false); const [error, setError] = useState(""); const [consent, setConsent] = useState(false);
  const [form, setForm] = useState<any>({ work_type: "", operating_area: "", income_frequency: "", income_predictability: "", income_sources: "", essential_monthly_expenses: "", current_savings: "", existing_emi: "", financial_goal: "", borrowing_comfort: "" });
  const question = questions[step]; const value = form[question.key] || ""; const complete = value.trim() !== "";
  const select = (value: string) => { setForm({ ...form, [question.key]: value }); setOther(false); };
  const next = async () => { if (!complete) { setError("Choose an answer or add your own."); return; } setError(""); if (step < questions.length - 1) { setStep(step + 1); return; } if (!consent) { setError("Please confirm consent before continuing."); return; } const payload = { work_type: form.work_type, operating_area: form.operating_area, income_frequency: form.income_frequency, primary_platform: "Worker-provided", secondary_income_sources: Math.max(0, Number(form.income_sources.replace(/\D/g, "")) - 1) || 0 }; const survey = { ...form, essential_monthly_expenses: Number(form.essential_monthly_expenses), current_savings: Number(form.current_savings), emergency_savings: Number(form.current_savings), existing_debt: 0, existing_emi: Number(form.existing_emi), desired_savings_goal: Number(form.current_savings) + 5000, financial_concern: "Irregular income", spending_categories: ["Worker-provided essentials"] }; try { if (!IS_MOCK_MODE) { await apiFetch("/api/consent/grant", { method: "POST" }); await apiFetch("/api/worker/profile", { method: "PUT", body: JSON.stringify(payload) }); await apiFetch("/api/survey", { method: "PUT", body: JSON.stringify(survey) }); } onDone(); } catch { setError("We could not save this session. Please try again."); } };
  return <div className="survey-screen"><section className="survey-panel"><div className="survey-top"><div><div className="eyebrow">PRIVATE SETUP</div><h1>Build your resilience view</h1></div><span>{step + 1} / {questions.length}</span></div><div className="progress"><i style={{ width: `${((step + 1) / questions.length) * 100}%` }} /></div><p className="privacy-warning">Your answers are used only to generate this private AEGIS session. They are not sold, shared with, or used by employers, delivery platforms, lenders, or other businesses.</p><section className="question"><label>{question.label}</label>{question.hint && <small>{question.hint}</small>}{question.type === "number" ? <input autoFocus inputMode="numeric" type="number" min="0" placeholder="Enter an amount in rupees" value={value} onChange={event => setForm({ ...form, [question.key]: event.target.value })} /> : <div className="options">{question.options?.map(option => <button type="button" key={option} className={value === option && !other ? "selected" : ""} onClick={() => select(option)}>{option}</button>)}<button type="button" className={other ? "selected" : ""} onClick={() => { setOther(true); setForm({ ...form, [question.key]: "" }); }}>Other</button></div>}{other && <input autoFocus placeholder="Write your answer" value={value} onChange={event => setForm({ ...form, [question.key]: event.target.value })} />}</section>{step === questions.length - 1 && <label className="consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />I consent to use these answers to create my private AEGIS guidance in this session. I understand this is not shared with businesses.</label>}{error && <p className="notice">{error}</p>}<div className="survey-actions">{step > 0 && <button className="secondary" onClick={() => { setStep(step - 1); setOther(false); }}>Back</button>}<button className="primary" onClick={next}>{step === questions.length - 1 ? "Create my resilience view" : "Continue"}</button></div></section></div>;
}

function Sidebar({ page, setPage, data }: { page: Page; setPage: (page: Page) => void; data: any }) { return <aside className="sidebar"><div className="brand"><div className="brand-mark" /><div><strong>AEGIS</strong><span>WORKER RESILIENCE</span><small>Private financial decision support</small></div></div><nav aria-label="Main">{navGroups.map(group => <section key={group.title}><label>{group.title}</label>{group.pages.map(([id, title]) => <button key={id} className={page === id ? "active" : ""} aria-current={page === id ? "page" : undefined} onClick={() => setPage(id)}>{title}</button>)}</section>)}</nav><div className="side-status"><label>DATA STATUS</label><p>Financial data<br /><b>SYNTHETIC DEMO</b></p><p>Weather signal<br /><b>{data.climate.source.includes("LIVE") ? "LIVE FORECAST" : "DEMO FALLBACK"}</b></p></div></aside>; }

function Content({ page, data, reload, openTrace, notify }: { page: Page; data: any; reload: () => void; openTrace: () => void; notify: (kind: "success" | "error", text: string) => void }) { if (page === "overview") return <div className="page"><Decision data={data} openTrace={openTrace} /><div className="three"><Resilience data={data} /><Income data={data} /><Monitor data={data} /></div><div className="two"><Guidance data={data} /><Borrow data={data} notify={notify} /></div></div>; if (page === "income") return <div className="page"><Income data={data} /><IncomeDetails data={data} /><IncomeForecast data={data} /></div>; if (page === "resilience") return <div className="page narrow"><Resilience data={data} /></div>; if (page === "monitor") return <div className="page narrow"><Monitor standalone data={data} /></div>; if (page === "models") return <Models data={data} />; if (page === "simulator") return <Simulator data={data} />; if (page === "borrowing") return <div className="page narrow"><Borrow data={data} full notify={notify} /></div>; if (page === "guidance") return <div className="page narrow"><Guidance data={data} /></div>; if (page === "schemes") return <SchemeFinder data={data} />; if (page === "profile") return <Profile data={data} reload={reload} notify={notify} />; if (page === "privacy") return <Privacy notify={notify} />; return <Alerts data={data} />; }

function Alerts({ data }: { data: any }) {
  const alerts = Array.isArray(data.alerts) ? data.alerts : [];
  const levelTone = (level: string) => level === "CRITICAL" ? "red" : level === "WARNING" ? "amber" : "blue";
  return <div className="page narrow">
    <PageHeading title="Alerts and history" text="Only meaningful updates are shown: runway changes, weather disruption, repayment-risk changes, and decision changes." />
    <section className="panel">
      {alerts.length === 0 && <p className="empty">No new alerts for this private demo session.</p>}
      {alerts.map((alert: any, index: number) => <div className="action" key={index}><label><span className={`badge badge-${levelTone(alert.level)}`}>{alert.level}</span> {alert.title}</label><p>{alert.text}</p></div>)}
    </section>
  </div>;
}

function IncomeForecast({ data }: { data: any }) {
  const forecast = data.income_forecast; if (!forecast) return null;
  return <section className="panel">
    <div className="panel-head"><label>NEXT-WEEK INCOME FORECAST</label><b>PREDICTIVE</b></div>
    <div className="four">
      <Metric label="Forecast" value={money(forecast.forecast_next_week)} note="next week" />
      <Metric label="Likely range" value={`${money(forecast.range_low)} – ${money(forecast.range_high)}`} />
      <Metric label="Trend" value={<Badge label={forecast.trend} />} />
      <Metric label="Method" value={forecast.method} />
    </div>
    <p className="fine">{forecast.confidence_note}</p>
  </section>;
}

function PageHeading({ title, text }: { title: string; text: string }) { return <div className="page-heading"><div className="eyebrow">AEGIS</div><h1>{title}</h1><p>{text}</p></div>; }
function Decision({ data, openTrace }: { data: any; openTrace: () => void }) { return <section className={`decision decision-${tone(data.decision.primary_action)}`}><div><div className="eyebrow">THIS WEEK'S RECOMMENDATION</div><h1>{data.decision.primary_action}</h1><p>{data.decision.explanation}</p><button className="text-button" onClick={openTrace}>Inspect the decision path</button></div><div className="decision-grid"><Metric label="Safe to save" value={money(data.safe_to_save)} note="for this week" /><Metric label="Safe borrowing" value={money(data.safe_to_borrow.safe_borrowing_capacity)} note={data.safe_to_borrow.decision || "not a loan offer"} /><Metric label="Check again" value={data.decision.next_check} note="after new income data" /></div></section>; }
function Resilience({ data }: { data: any }) { const resilience = data.resilience; const radar = Object.entries(resilience.breakdown).map(([label, value]: any) => ({ label, value })); return <section className="panel"><div className="panel-head"><label>RESILIENCE SCORE</label><Badge label={resilience.ladder} /></div><div className={`score score-${tone(resilience.ladder)}`}><AnimatedNumber value={resilience.score} /><small>/100</small></div><Meter value={resilience.score} /><ResponsiveContainer width="100%" height={220}><RadarChart data={radar} outerRadius="72%"><PolarGrid stroke="#c7d0dc" /><PolarAngleAxis dataKey="label" tick={{ fontSize: 11, fill: "#475467", fontWeight: 600 }} /><PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} /><Radar dataKey="value" stroke="#1d4ed8" fill="#1d4ed8" fillOpacity={0.35} isAnimationActive animationDuration={700} /></RadarChart></ResponsiveContainer>{Object.entries(resilience.breakdown).map(([label, value]: any) => <div className="breakdown" key={label}><span>{label}</span><Meter value={value} /><b>{Math.round(value)}</b></div>)}<p className="fine">Internal decision-support metric, not a credit score.</p></section>; }
function Income({ data }: { data: any }) { const intelligence = data.intelligence; const weekly = weeklyIncome(data); const variation = data.models?.income_volatility?.level || data.ml.income_volatility.level; return <section className="panel"><div className="panel-head"><label>WEEKLY INCOME</label><Badge label={`${variation} VARIATION`} /></div><div className="metric-row"><Metric label="Median" value={money(intelligence.median_income)} /><Metric label="Recovery" value={`About ${data.ml.income_recovery.expected_recovery_weeks} weeks`} /></div><ResponsiveContainer width="100%" height={200}><BarChart data={weekly}><XAxis dataKey="week" tickLine={false} axisLine={false} tick={{ fontSize: 12, fontWeight: 600 }} /><YAxis tickFormatter={value => `₹${value / 1000}k`} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} /><Tooltip formatter={(value: any) => money(value)} /><ReferenceLine y={intelligence.median_income} stroke="#1d4ed8" strokeWidth={2} strokeDasharray="4 3" /><Bar dataKey="amount" isAnimationActive animationDuration={700}>{weekly.map((item: any, index: number) => <Cell key={index} fill={item.low ? "#b45309" : "#1d4ed8"} stroke="#111827" strokeWidth={2} />)}</Bar></BarChart></ResponsiveContainer><p className="fine">Bars below the blue reference line are below your median weekly income.</p></section>; }
function IncomeDetails({ data }: { data: any }) { const info = data.intelligence; return <section className="panel"><div className="panel-head"><label>INCOME AND SPENDING</label><b>SYNTHETIC DEMO</b></div><div className="four"><Metric label="Average weekly income" value={money(info.average_income)} /><Metric label="Essential expenses" value={money(info.essential_expenses)} /><Metric label="Cash-flow surplus" value={money(info.cash_flow_surplus)} /><Metric label="Emergency buffer" value={money(info.emergency_buffer)} /></div><p className="fine">This transaction history is generated synthetically for this demo session — it stands in for a real bank/Account Aggregator feed, which this MVP never connects to. It's randomized per login, not a fixed number.</p></section>; }
function Monitor({ standalone, data }: { standalone?: boolean; data: any }) { const climate = data.climate; return <>
  <section className="panel">
    <div className="panel-head"><label>72-HOUR WORK MONITOR</label><Badge label={`${climate.risk} RISK`} /></div>
    <h3>{climate.conditions}</h3>
    <p>Potential work interruption: {climate.work_disruption_pct}%. Potential income impact: {money(climate.possible_income_impact)}.</p>
    <div className="source-box"><label>FORECAST SOURCE</label><p>{climate.source}</p></div>
    <p className="fine">The source label changes when a live forecast cannot be reached — a failed attempt is retried automatically on your next check, it isn't stuck for the rest of your session.</p>
  </section>
  {standalone && <section className="panel">
    <div className="panel-head"><label>IF DISRUPTION HAPPENS</label><b>WHAT TO DO</b></div>
    <div className="action"><label>BEFORE</label><p>Reserve essential cash now rather than after work is interrupted — see your action plan for the specific amount.</p></div>
    <div className="action"><label>DURING</label><p>Pause discretionary spending until the 72-hour window has passed and your income has stabilized.</p></div>
    <div className="action"><label>AFTER</label><p>Reassess as soon as new income data comes in — the disruption estimate is a planning window, not a guarantee.</p></div>
  </section>}
</>; }
function Guidance({ data }: { data: any }) { return <section className="panel"><div className="panel-head"><label>ACTION PLAN</label><b>DOABLE NEXT STEPS</b></div>{data.recommendations.map((item: any) => <div className="action" key={item.when}><label>{item.when}</label><p>{item.text}</p></div>)}</section>; }
function Borrow({ data, full, notify }: { data: any; full?: boolean; notify?: (kind: "success" | "error", text: string) => void }) { const [amount, setAmount] = useState(80000); const [rate, setRate] = useState(18); const [months, setMonths] = useState(12); const [result, setResult] = useState(data.safe_to_borrow); const [busy, setBusy] = useState(false); const assess = async () => { if (IS_MOCK_MODE) return; setBusy(true); try { setResult(await apiFetch<any>("/api/borrowing", { method: "POST", body: JSON.stringify({ amount, annual_rate_pct: rate, tenure_months: months }) })); notify?.("success", "Affordability assessed for this scenario."); } catch { notify?.("error", "Could not assess affordability. Please try again."); } finally { setBusy(false); } }; return <section className="panel"><div className="panel-head"><label>SAFE BORROWING</label><b>NOT A LOAN OFFER</b></div>{full && <div className="form-grid"><label>Amount<input type="number" value={amount} onChange={event => setAmount(Number(event.target.value))} /></label><label>Annual rate<input type="number" value={rate} onChange={event => setRate(Number(event.target.value))} /></label><label>Months<input type="number" value={months} onChange={event => setMonths(Number(event.target.value))} /></label><button className="primary" onClick={assess} disabled={busy}>{busy ? "Assessing…" : "Assess affordability"}</button></div>}<div className="four"><Metric label="Requested" value={money(result.credit_requested || amount)} /><Metric label="Safely affordable" value={money(result.safe_borrowing_capacity)} /><Metric label="Estimated EMI" value={result.emi ? money(result.emi) : "Not calculated"} /><Metric label="Repayment risk" value={<Badge label={result.repayment_risk} />} /></div><p className="fine">{result.message || "Affordability guidance only."}</p></section>; }
function Simulator({ data }: { data: any }) { const [scenario, setScenario] = useState("income_decrease_30"); const [result, setResult] = useState<any>(); const [busy, setBusy] = useState(false); const run = async () => { setBusy(true); try { setResult(IS_MOCK_MODE ? { result: data, baseline_unchanged: true } : await apiFetch<any>("/api/simulation", { method: "POST", body: JSON.stringify({ scenario }) })); } finally { setBusy(false); } }; const comparison = result ? [{ name: "Baseline", score: data.resilience.score, fill: "#94a3b8" }, { name: "Scenario", score: result.result.resilience.score, fill: result.result.resilience.score < data.resilience.score ? "#b42318" : "#1d4ed8" }] : []; return <div className="page narrow"><PageHeading title="Income shock simulator" text="Test a possible change without altering your baseline information." /><section className="panel"><label className="field-label">SCENARIO</label><select value={scenario} onChange={event => setScenario(event.target.value)}><option value="income_decrease_10">Income decreases by 10%</option><option value="income_decrease_30">Income decreases by 30%</option><option value="income_decrease_50">Income decreases by 50%</option><option value="income_increase_10">Income increases by 10%</option><option value="climate_disruption">Weather disrupts work</option><option value="unexpected_expense">Unexpected essential expense</option></select><button className="primary" onClick={run} disabled={busy}>{busy ? "Calculating" : "Run scenario"}</button>{result && <><div className="four"><Metric label="Baseline score" value={<AnimatedNumber value={data.resilience.score} />} /><Metric label="Scenario score" value={<AnimatedNumber value={result.result.resilience.score} />} /><Metric label="New decision" value={<Badge label={result.result.decision.primary_action} />} /><Metric label="Safe to save" value={money(result.result.safe_to_save)} /></div><ResponsiveContainer width="100%" height={130}><BarChart data={comparison} layout="vertical" margin={{ left: 8, right: 20 }}><XAxis type="number" domain={[0, 100]} hide /><YAxis type="category" dataKey="name" width={72} tickLine={false} axisLine={false} /><Tooltip /><Bar dataKey="score" isAnimationActive>{comparison.map((entry, index) => <Cell key={index} fill={entry.fill} stroke="#111827" strokeWidth={2} />)}</Bar></BarChart></ResponsiveContainer></>}<p className="fine">Your baseline remains unchanged.</p></section></div>; }
function Models({ data }: { data: any }) { const models = Object.values(data.models || {}).filter((model: any) => model && typeof model === "object" && model.name) as any[]; const ml = data.models?.ml_repayment_risk; return <div className="page narrow"><PageHeading title="How AEGIS works" text="Three explainable heuristics combine private session answers, synthetic demo records, and a weather signal, plus one genuinely trained ML classifier." /><section className="panel">{models.map(model => <div className="action" key={model.name}><label>{model.name}</label><p>{model.method}. Inputs: {model.inputs.join(", ")}. Confidence: {Math.round(model.confidence * 100)}%.</p></div>)}<p className="fine">{data.models?.disclosure || "These models are explainable decision support, not a credit score."}</p></section>{ml && <MLModelDetail model={ml} />}</div>; }

function MLModelDetail({ model }: { model: any }) {
  const cv = model.cross_validation;
  const importances = model.feature_importance;
  return <section className="panel">
    <div className="panel-head"><label>{model.name?.toUpperCase() || "ML MODEL"} — VALIDATION DETAIL</label><b>{model.method}</b></div>
    <div className="four">
      <Metric label="Held-out accuracy" value={`${Math.round((model.holdout_accuracy || 0) * 100)}%`} note={`${model.trained_on || ""}`} />
      <Metric label="Held-out AUC" value={model.holdout_auc} />
      {cv && <Metric label={`${cv.folds}-fold CV accuracy`} value={`${Math.round(cv.accuracy_mean * 100)}% ± ${Math.round(cv.accuracy_std * 100)}`} note="mean ± std across folds" />}
      {cv && <Metric label={`${cv.folds}-fold CV AUC`} value={`${cv.auc_mean} ± ${cv.auc_std}`} note="mean ± std across folds" />}
    </div>
    <p className="fine">Both a single held-out test score and {cv?.folds || 5}-fold cross-validation are reported so the accuracy figure is statistically defensible, not the result of one lucky split. Real-world repayment-risk models typically achieve 0.65–0.85 AUC — this model's {model.holdout_auc} is consistent with that range, not inflated to look artificially perfect.</p>
    {importances && importances.length > 0 && <>
      <div className="panel-head" style={{ marginTop: "18px" }}><label>FEATURE IMPORTANCE</label><b>WHAT THE MODEL ACTUALLY LEANS ON</b></div>
      {importances.map((item: any) => <div className="breakdown" key={item.feature}><span>{item.feature.replace(/_/g, " ")}</span><Meter value={item.importance * 100} /><b>{Math.round(item.importance * 100)}%</b></div>)}
    </>}
  </section>;
}
function Profile({ data, reload, notify }: { data: any; reload: () => void; notify: (kind: "success" | "error", text: string) => void }) { const [profile, setProfile] = useState(data.worker); const [busy, setBusy] = useState(false); const save = async () => { setBusy(true); try { if (!IS_MOCK_MODE) { await apiFetch("/api/worker/profile", { method: "PUT", body: JSON.stringify(profile) }); reload(); } notify("success", "Profile saved."); } catch { notify("error", "Could not save your profile. Please try again."); } finally { setBusy(false); } }; return <div className="page narrow"><PageHeading title="Financial profile" text="Use broad details only. AEGIS does not ask for bank credentials or exact location." /><section className="panel form-grid">{Object.entries(profile).filter(([key]) => key !== "worker_id").map(([key, value]) => <label key={key}>{key.replace(/_/g, " ")}<input value={value as any} onChange={event => setProfile({ ...profile, [key]: event.target.value })} /></label>)}<button className="primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save profile"}</button></section></div>; }
function Privacy({ notify }: { notify: (kind: "success" | "error", text: string) => void }) { const [status, setStatus] = useState<any>(); const call = async (path: string, method = "POST") => { try { if (!IS_MOCK_MODE) setStatus(await apiFetch<any>(path, { method })); notify("success", method === "POST" && path.includes("grant") ? "Session consent granted." : "Session consent withdrawn."); } catch { notify("error", "Could not update consent. Please try again."); } }; return <div className="page narrow"><PageHeading title="Privacy and consent" text="Your session is private. Data is not used by businesses." /><section className="panel"><div className="privacy-list"><p><b>Not shared:</b> employers, delivery platforms, lenders, insurers, or other businesses.</p><p><b>Not collected:</b> bank passwords, OTPs, PINs, card numbers, or exact location.</p><p><b>Used for:</b> the resilience guidance shown in this private demo session.</p></div><button className="primary" onClick={() => call("/api/consent/grant")}>Give session consent</button><button className="secondary" onClick={() => call("/api/consent/revoke")}>Withdraw session consent</button>{status && <pre>{JSON.stringify(status, null, 2)}</pre>}</section></div>; }
function Trace({ data, close }: { data: any; close: () => void }) { return <div className="overlay" onClick={close}><section className="trace" onClick={event => event.stopPropagation()}><button className="secondary" onClick={close}>Close</button><h2>Decision path</h2><p>{data.decision.explanation}</p>{data.trace.map((item: string, index: number) => <div className="trace-row" key={item}><b>{index + 1}</b><span>{item}</span><em>{index === data.trace.length - 1 ? data.decision.primary_action : "Reviewed"}</em></div>)}</section></div>; }
function Metric({ label, value, note }: { label: string; value: any; note?: string }) { return <div className="metric"><label>{label}</label><strong>{value}</strong>{note && <small>{note}</small>}</div>; }
function Meter({ value }: { value: number }) { return <div className="meter"><i style={{ width: `${value}%` }} /></div>; }

// Maps a status word to a semantic color so risk/decision language reads at a glance, not just as text.
function tone(label: string): "green" | "amber" | "red" | "blue" {
  const key = String(label).toUpperCase();
  if (["LOW", "RESILIENT", "SAVE", "WITHIN DEMO SAFETY BAND"].some(k => key.includes(k))) return "green";
  if (["HIGH", "CRITICAL", "FRAGILE", "PROTECT CASH", "DO NOT BORROW"].some(k => key.includes(k))) return "red";
  if (["MEDIUM", "VULNERABLE", "BUILDING", "REASSESS", "CONSIDER ONLY IF ESSENTIAL"].some(k => key.includes(k))) return "amber";
  return "blue";
}
function Badge({ label }: { label: string }) { return <span className={`badge badge-${tone(label)}`}>{label}</span>; }

function SchemeFinder({ data }: { data: any }) {
  const estimatedMonthly = Math.round((data.intelligence?.average_income || 0) * 4.33) || 15000;
  const [age, setAge] = useState(28);
  const [income, setIncome] = useState(estimatedMonthly);
  const [hasBank, setHasBank] = useState(true);
  const [results, setResults] = useState<EligibilityResult[] | null>(null);
  const find = () => setResults(evaluateSchemes({ age, monthlyIncome: income, hasBankAccount: hasBank }));
  const eligible = (results ?? []).filter(r => r.eligible && !r.manualCheck);
  const ineligible = (results ?? []).filter(r => !r.eligible && !r.manualCheck);
  const manual = (results ?? []).filter(r => r.manualCheck);
  return <div className="page narrow">
    <PageHeading title="Government scheme finder" text="A few details surface which central government financial-inclusion schemes may apply. This runs entirely in your browser — nothing is sent to a server, so it works offline once the page has loaded." />
    <section className="panel">
      <div className="form-grid">
        <label>Age<input type="number" min={10} max={100} value={age} onChange={event => setAge(Number(event.target.value))} /></label>
        <label>Estimated monthly income (₹)<input type="number" min={0} step={500} value={income} onChange={event => setIncome(Number(event.target.value))} /></label>
        <label className="consent"><input type="checkbox" checked={hasBank} onChange={event => setHasBank(event.target.checked)} />I have a savings bank or post-office account</label>
        <button className="primary" onClick={find}>Find my schemes</button>
      </div>
      <p className="fine">Informational only — simplified from public scheme guidelines for this demo and not an official eligibility determination. Always confirm current rules at myscheme.gov.in or the scheme's own site before applying.</p>
    </section>
    {results && <>
      {eligible.length > 0 && <section className="panel">
        <div className="panel-head"><label>LIKELY ELIGIBLE</label><Badge label={`${eligible.length} scheme${eligible.length === 1 ? "" : "s"}`} /></div>
        {eligible.map(scheme => <SchemeCard key={scheme.id} scheme={scheme} />)}
      </section>}
      {manual.length > 0 && <section className="panel">
        <div className="panel-head"><label>CHECK SEPARATELY</label><b>OCCUPATION OR DATABASE SPECIFIC</b></div>
        {manual.map(scheme => <SchemeCard key={scheme.id} scheme={scheme} />)}
      </section>}
      {ineligible.length > 0 && <section className="panel">
        <div className="panel-head"><label>NOT CURRENTLY ELIGIBLE</label><b>{ineligible.length}</b></div>
        {ineligible.map(scheme => <SchemeCard key={scheme.id} scheme={scheme} />)}
      </section>}
    </>}
  </div>;
}
function SchemeCard({ scheme }: { scheme: EligibilityResult }) {
  const status = scheme.manualCheck ? "check" : scheme.eligible ? "yes" : "no";
  return <div className={`scheme-card scheme-${status}`}>
    <div className="scheme-head"><span className="scheme-category">{scheme.category}</span><strong>{scheme.name}</strong></div>
    <p className="scheme-benefit">{scheme.benefit}</p>
    <ul className="scheme-reasons">{scheme.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul>
    <p className="fine">{scheme.note} — {scheme.administeredBy} · {scheme.officialSite}</p>
  </div>;
}
