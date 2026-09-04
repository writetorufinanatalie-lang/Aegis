# AEGIS — Presentation Speech
### Team Horizon Tech · Innovation Unbound, Round 2 · VIT Chennai

*Roughly 4–5 minutes spoken. Split across two presenters wherever you see a speaker break — swap the labels around to match who's comfortable with which section. Bracketed notes are stage directions, not something to say out loud.*

---

**[SPEAKER 1 — Open]**

Every day, over 400 million people in India go to work without knowing how much they'll earn. A delivery rider, a domestic worker, a driver, a freelancer — their income can swing thirty, forty, fifty percent week to week. Banks and lending products weren't built for that. They assume a salary slip. They assume a fixed date every month. For a gig worker, that assumption is the whole problem.

We built AEGIS to sit on the other side of that gap — not as a bank, and not as a lender, but as a private financial co-pilot that helps an informal worker answer one question every week: *can I safely spend, save, or borrow right now?*

**[SPEAKER 2]**

What makes AEGIS different isn't just that it answers that question — it's *how* it answers it, and who it protects while doing so. Let us walk you through both sides of that.

On the worker side, AEGIS combines three explainable models — income stability, weather-to-work disruption, and repayment resilience — with a genuinely trained machine learning classifier, a gradient-boosted model, for repayment risk. And we want to be upfront about something most hackathon demos aren't: we disclose its real holdout accuracy and AUC on-screen. No inflated ninety-nine percent claim. It's an honest model, trained on synthetic data, and we say so, because a financial tool that lies about its own confidence isn't one anyone should trust.

**[SPEAKER 1]**

On top of that we added predictive income forecasting — a trend model that projects next week's likely income range from a worker's own history — and an automated alert engine that watches for meaningful changes: falling cash runway, rising weather risk, a shift in repayment risk, and surfaces only what actually matters, instead of flooding someone with noise.

And because financial resilience isn't only about credit, we built a government scheme eligibility finder directly into the app. A worker enters their age, income, and whether they hold a bank account, and AEGIS checks it against real central government financial-inclusion schemes — entirely in the browser, no server round-trip, which means it keeps working even offline, in exactly the low-connectivity conditions our actual users live in.

**[SPEAKER 2 — Security]**

Now here's the part we think matters most for a *banking and financial inclusion* track: security isn't a feature we bolted on, it's the foundation the whole product sits on.

A worker's financial data — their income, their expenses, their debt — is some of the most sensitive information a person has. So every session in AEGIS is completely isolated. Logging in creates an independent, private analysis engine for that one session; there is no code path, anywhere in our backend, that lets one session read another's data.

And when we built the business and lender side of AEGIS — because lenders *do* need portfolio-level insight to serve this market — we didn't just hide individual records behind a permission check. We made it structurally impossible to leak one. The business API runs on a completely separate credential, a separate authentication realm, and a separate dataset that is aggregated by construction. There is no endpoint, anywhere in the system, that returns a single worker's name, transactions, or identity to a business key — because that endpoint simply doesn't exist. A lender using AEGIS sees average resilience scores, repayment-risk distribution across a portfolio, safe aggregate lending capacity — real, actionable insight — and never a single worker's private data.

**[SPEAKER 1]**

We also treated failure as a first-class design problem, not an afterthought. Every action gives real success or error feedback instead of failing silently. A crash anywhere in the app is caught and shown as a recoverable screen, never a blank page. Every route has a real URL and a genuine 404 for anything invalid. Sessions expire and are invalidated server-side on logout, not just cleared from local storage. None of this is glamorous, but in financial software, it's the difference between a tool people can trust and one they can't.

**[SPEAKER 2 — Close]**

So that's AEGIS: honest machine learning instead of inflated claims, predictive and automated insight instead of static dashboards, real value for lenders without ever touching a worker's privacy, and security that's structural, not cosmetic.

We built this in twenty-four hours for four hundred million people who go to work every day not knowing what they'll earn. We'd love to show you how it works.

*[Transition to live demo]*

---

**Optional one-line closer if asked to wrap up fast:**
*"AEGIS: financial resilience for the workers the system was never built for — private by design, honest by default."*
