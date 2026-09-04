# AEGIS — Judge Q&A Prep
### Team Horizon Tech · Innovation Unbound, Round 2

Use this to prep, not to read verbatim. Answers are written the way you'd actually say them — short, direct, and honest about limits. When a question has a "why this matters" note, it's there because that question is likely to come from someone with real fintech/ML background, not just a general audience.

---

## Machine learning & data

**Q: Your model's accuracy is only ~75%, AUC ~0.81. Why isn't it higher?**
Because the synthetic training data has deliberate label noise built in, and honestly, real financial behavior is noisy too. Production credit-risk and alternative-scoring models — the ones banks and fintechs actually deploy for thin-file or gig-worker populations — typically land in the 0.65–0.85 AUC range. Our 0.813 is right in that realistic band. We could have generated easier synthetic data to inflate the number, but that would have made the metric meaningless. We chose to report the honest number instead.

**Q: How do you know 75%/0.81 isn't just a lucky train/test split?**
We also ran 5-fold stratified cross-validation across the full dataset: mean accuracy 75.0% (±1.5 points across folds), mean AUC 0.817 (±0.009). That's very close to the single-split numbers, which tells us the result is stable, not a fluke of one particular split. Both numbers are shown in the app under "How AEGIS works."

**Q: Isn't this just an if-else system with an ML label stuck on it?**
No — we deliberately kept those separate and labeled them differently in the product. Three of the four models (income stability, weather-to-work disruption, repayment resilience) *are* transparent deterministic heuristics, and we say so explicitly — we don't call them AI. The fourth, the repayment-risk classifier, is a real scikit-learn GradientBoostingClassifier, actually trained via gradient boosting on labeled data, with a documented training process, held-out test metrics, and cross-validation. You can see the feature importances it learned, not just the ones we told it mattered.

**Q: What features does the model actually use, and does that make sense?**
Five: income volatility, financial runway (days), debt burden %, weather disruption %, and savings rate. Feature importance shows financial runway dominates at ~77% — which lines up with financial common sense: how many days of buffer you have is the single strongest predictor of near-term repayment stress. That the model rediscovered that on its own, rather than us hard-coding it as the most important factor, is part of why we trust the training process.

**Q: Why GradientBoostingClassifier and not a neural network / deep learning?**
Wrong tool for this problem. We have five tabular, mostly-numeric features and a binary outcome — that's the textbook case where gradient-boosted trees outperform deep learning, train in seconds instead of needing a GPU, and stay interpretable via feature importance. Reaching for a neural net here would be complexity for the sake of a buzzword, not because it's the right model.

**Q: This is trained on synthetic data — what happens with real data?**
The architecture doesn't change — `_synthesize_training_set()` would be replaced by a real, consented, labeled dataset from actual repayment outcomes, and the same training/validation/reporting pipeline runs as-is. What we can't ethically do in 24 hours is collect real financial-hardship data from real gig workers without proper consent infrastructure and regulatory review, so we built and validated the full pipeline honestly on synthetic data instead of skipping validation or faking a dataset.

**Q: Does the model retrain itself over time / learn from new users?**
Not currently — it retrains fresh from the synthetic generator every time the server starts, specifically so the reported numbers are always reproducible and never quietly drift. In production you'd want a proper retraining pipeline with drift monitoring and a held-out validation set that's refreshed on a schedule, not live online learning — online learning on financial risk models is a fairness and stability risk, not a nice-to-have.

---

## Security & privacy

**Q: How do you stop one worker from seeing another worker's data?**
Every login creates a completely independent session, backed by its own isolated analysis engine instance server-side. There's no shared global state and no endpoint that accepts a foreign session token or a worker ID to look up someone else's record — session isolation is structural, not a permission check we could forget to add somewhere.

**Q: You said businesses get insights without seeing individual data — how is that actually enforced, not just promised?**
Two separate things enforce it. First, authentication: the business portal uses a completely different credential (`X-AEGIS-Business-Key`) from worker sessions (`X-AEGIS-Session`) — they're different auth realms, and one can't be used to authenticate as the other. Second, and more importantly: there is no API endpoint, anywhere in the backend, that returns a single worker's record to a business key. The portfolio-summary endpoint only ever computes aggregates — averages, distributions, counts — so there's no individual record to leak even if someone tried. We wrote an automated test that inspects every key in the business API's response and asserts none of them match identifying fields like worker_id, name, or transactions.

**Q: What data do you actually collect from a worker?**
Self-reported: work type, city/area, income frequency, a short set of survey answers about income and expenses. We explicitly never ask for bank passwords, OTPs, PINs, card numbers, or exact location — that's stated on the privacy screen inside the app, not just in this doc.

**Q: What about consent — can someone revoke it?**
Yes, there's a consent grant/revoke flow in the app, and it's a real API call, not cosmetic. Sessions also expire automatically after a period of inactivity (server-side TTL pruning), and logging out actually invalidates the session token on the backend — earlier in our build, logout only cleared local storage on the device, which left the token technically still valid; we fixed that so logout is real.

**Q: Is this compliant with India's data protection law (DPDP Act)?**
We designed with data minimization and purpose limitation in mind — collect only what's needed, keep worker and business data structurally separate, make consent explicit and revocable — which are the same principles the DPDP Act is built around. We haven't done a formal legal compliance audit, and we'd say that plainly if asked: that's real work a production version would need before launch, not something a 24-hour hackathon build can honestly claim to have completed.

**Q: What happens if your server crashes or restarts?**
Sessions are in-memory for this MVP, so a restart clears them — that's a known, deliberate hackathon-scope limitation, not something we're hiding. Moving to persistent, encrypted session storage (e.g. Redis or a database with encryption at rest) is the first infrastructure step before this goes further than a demo.

---

## Product, business model & impact

**Q: Who pays for this — what's the business model?**
Two possible customers: informal lenders and microfinance institutions who'd pay for portfolio-level risk insight instead of building their own gig-worker risk model from scratch (B2B SaaS), and/or platforms (delivery, gig-work apps) that want to offer this as a value-add to retain workers. The worker-facing side stays free — charging workers for financial guidance for people with irregular income defeats the point of financial inclusion.

**Q: How is this different from existing apps like PayMe India, KreditBee, or gig-platform earnings dashboards?**
Most of what's out there is either a lending product wearing a friendly UI, or a pure earnings tracker with no risk modeling. AEGIS is neither — it deliberately doesn't lend or extend credit itself; it's decision support that says "here's what you can safely do this week," plus it's the only one of these we're aware of that's explicit that it's not a credit score, and that separates aggregate lender insight from individual privacy as a structural (not policy) guarantee.

**Q: What stops your "safe borrowing capacity" number from just being a disguised credit score?**
Framing and consequence, mostly. A credit score follows a person and gates their access to formal credit for years. Our number is a session-local affordability estimate — recomputed fresh from a worker's own recent data, shown only to them, not reported to a bureau, not shared with lenders per-individual, and explicitly labeled "not a loan offer, not financial advice" everywhere it appears in the UI.

**Q: What happens if the model is wrong about someone — false HIGH risk for someone who's actually fine?**
That's exactly why AEGIS never auto-denies or auto-approves anything — it's decision support for the worker themselves, not an automated gatekeeper deciding on a lender's behalf. A false HIGH reading affects the guidance shown to that one person in their own private session, not an external credit decision made about them without their knowledge.

**Q: How does the government scheme finder stay accurate as scheme rules change?**
It's built from simplified public scheme guidelines as of when we built it, and we say so on the page itself, along with a direct pointer to myscheme.gov.in and each scheme's official site to confirm current rules before applying — we treat it as a starting point for discovery, not a source of legal truth. In production this would need a maintained, periodically-refreshed ruleset, ideally sourced from an official API rather than hand-encoded.

**Q: Why does the scheme finder run entirely offline / client-side?**
Two reasons: gig workers are exactly the population most likely to be on unreliable or costly mobile data, so anything that requires a live connection excludes the people it's meant to help; and it also means zero income/eligibility data ever leaves the device for that feature — the strongest possible privacy guarantee is not sending the data anywhere at all.

---

## Architecture & scale

**Q: Is this actually usable outside a demo, or just a hackathon prototype?**
Structurally, it's built like a real product — separate auth realms, real error handling with no blank-page failures, a genuine 404 and error boundary, mobile-responsive layout, disclosed and validated ML. What's still hackathon-scope: in-memory sessions instead of a database, synthetic instead of real financial data, and a modest automated test suite (7 tests) for something calling itself business-grade. We'd say that directly if asked — the foundation is sound, the productionization work (persistence, real data pipelines, security audit, load testing) is what's left.

**Q: What's your tech stack and why?**
React + TypeScript + Vite on the frontend, FastAPI + Pydantic on the backend, scikit-learn for the trained model, numpy for the forecasting math. FastAPI gives us fast iteration and automatic request validation via Pydantic, which matters a lot for a financial-adjacent app where malformed input shouldn't silently corrupt a result. React/TypeScript catches a large class of bugs at compile time rather than at 3am during a demo.

**Q: How would this scale to millions of workers?**
The heaviest cost today is retraining the ML model at every server start, which is fine for one demo instance but wouldn't scale as-is — in production you'd train and version the model once (or on a schedule), persist it, and serve predictions from the frozen artifact. Session state would move from in-memory Python dicts to a proper session store, and the synthetic-data heuristics would be replaced by the same pipeline running on real, consented data.

---

## If you get a genuinely hostile / trick question

**Q: Isn't "honest 75% accuracy" just a cover story for a model that doesn't actually work well?**
Take it head-on: 75% accuracy and 0.81 AUC, cross-validated, is a working model — it correctly separates higher- and lower-risk cases well above chance (50%), and it's in line with what real deployed credit-risk models achieve on genuinely hard, noisy financial-behavior data. The alternative — a hackathon demo claiming 98%+ — would be the actual red flag, because that number is not achievable honestly on a problem this noisy without something being wrong (leakage, overfitting, or an unrealistically easy synthetic dataset). We'd rather defend a real 0.81 than an unbelievable 0.98.

**Q: Why should we trust anything you built in 24 hours?**
You shouldn't trust it as a finished financial product — and we're not asking you to. What we'd ask you to evaluate is whether the *engineering judgment* is sound: honest metric reporting instead of inflated claims, structural (not just policy-level) privacy separation, real error handling instead of happy-path-only code, and a clear, spoken list of what's still missing before this could go further. That's what 24 hours can realistically prove.
