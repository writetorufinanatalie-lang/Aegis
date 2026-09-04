# AEGIS — worker financial resilience

AEGIS helps a delivery worker decide what protects their liquidity this week when income is irregular and weather may disrupt work. It is a hackathon MVP, not a lending, insurance, or financial-advice product.

## What the demo does

1. Starts a session with the demo account: `W001` / `demo123`.
2. Uses **synthetic, clearly labelled** income and spending records.
3. Fetches a live 72-hour Open-Meteo forecast for supported cities when available; otherwise it labels a conservative demo fallback.
4. Runs three transparent models: income stability, weather-to-work disruption, and repayment resilience.
5. Gives a concrete next action, shows why, and lets the user test an income shock without changing the baseline.

## Model disclosure

The three models are explainable deterministic heuristics. They are **not trained machine-learning models**, a credit score, or an automated credit decision. Their inputs and confidence are returned by `/api/models` and visible in **How AEGIS works**.

## Run

Prerequisites: Python 3.11+ and Node 22+.

```bash
pip install -r backend/requirements.txt
python -m uvicorn app:app --app-dir backend --reload --port 8000
npm install
npm run dev
```

Open the frontend on port 8443. `VITE_API_BASE_URL=http://localhost:8000` is configured in `.env`.

## Verify

```bash
python -m pytest backend/tests -q
npx tsc --noEmit
npm run build
```

## Data and privacy

- No bank passwords, OTPs, PINs, card numbers, or exact location are collected.
- Financial records are synthetic session data only.
- Weather is live only when the API is reachable and is visibly source-labelled.
- Consent controls govern the demo session state; they do not represent a production consent-management system.

## Architecture — what's actually running

The live app is a small, self-contained set of files:

- `src/App.tsx`, `src/main.tsx`, `src/index.css`, `src/lib/api.ts`, `src/lib/config.ts`
- `backend/app.py` + `backend/services/worker_finance.py`

Everything a judge or teammate needs to read to understand the product is in those seven files.

**Not wired into the running app** (`src/pages/*`, `src/components/Sidebar.tsx`, `src/context/AppContext.tsx`, `src/services/*`, `src/data/*`, `src/types/*`, and `backend/services/{risk_engine,financial_engine,recommendation_engine,repayment_engine,simulation_engine,alert_engine,consent_service,financial_health,financial_data_provider,weather_service}.py`, `backend/config/*`, `backend/ml/*`): this is the earlier **ClimateShield MSME** factory-heatwave prototype, kept from before AEGIS pivoted to worker income resilience. `main.tsx` only imports `App.tsx`, and `App.tsx` only imports `src/lib/api.ts` — none of the files above are ever reached by the running app, confirmed by `grep` for their import paths.

Before a judge browses the repo or a teammate joins, delete (or move to an `/archive` folder) everything in the "not wired in" list above — right now the repo tells two different product stories at once, which is the single biggest thing standing between this build and a clean walkthrough.
