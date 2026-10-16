# AEGIS

**Financial resilience decision support for gig and informal workers**

AEGIS helps workers plan around changing income, essential expenses, savings, debt repayments, and weather disruptions. It presents a suggested next step, explains the factors behind it, and lets users explore “what if” scenarios.

AEGIS is a hackathon MVP. It is not a lending product, credit score, or source of financial advice. **All financial records in this demo are synthetic.**

## What you can do

- Review an overview and a suggested action for the week.
- Explore sample income and spending data.
- See a 72-hour weather and work-disruption monitor for supported areas.
- Review financial resilience analysis, alerts, and model information.
- Test income and expense scenarios without changing the baseline demo data.
- Manage demo consent and clear the session’s synthetic data.
- View aggregate portfolio analytics through a separate business API.

## Run locally

### Requirements

- Python 3.11 or later
- Node.js 22 or later
- npm

### 1. Configure the frontend

From the project root, create a local environment file:

```bash
cp .env.example .env
```

On Windows Command Prompt:

```cmd
copy .env.example .env
```

The example configures the frontend to use the local backend at `http://localhost:8000`.

### 2. Start the backend

In a terminal at the project root:

```bash
python -m venv .venv
```

Activate the environment:

```bash
# Windows PowerShell
.venv\Scripts\Activate.ps1

# macOS / Linux
source .venv/bin/activate
```

Install dependencies and start the API:

```bash
pip install -r backend/requirements.txt
python -m uvicorn app:app --app-dir backend --reload --port 8000
```

The API documentation is available at [http://localhost:8000/docs](http://localhost:8000/docs).

### 3. Start the frontend

In a second terminal at the project root:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, usually [http://localhost:5173](http://localhost:5173).

## Demo access

Use the demo worker account:

- **Worker ID:** `W001`
- **Password:** `demo123`

The business API demo key is available from the backend at `/api/business/demo-key`. It is for demonstration only and must not be used as a production credential.

## Data, models, and privacy

- The worker financial records and business portfolio data are synthetic demo data.
- The app does not require bank passwords, one-time codes, PINs, or card numbers.
- Weather data is requested from Open-Meteo when available; the app labels the forecast source and uses a labelled fallback when it is unavailable.
- Worker sessions are isolated by session token and expire after inactivity. Logging out invalidates the session token.
- Worker session data and business portfolio analytics use separate API access paths. The business API returns aggregate demo analytics, not individual worker records.
- The worker decision models are transparent heuristics. They are not trained credit models or automated credit decisions. Any synthetic model results shown elsewhere in the demo should also be understood as experimental and not representative of real people.

These controls describe this demo implementation; they are not a claim of production-grade security, regulatory compliance, or a production consent-management system.

## Verify the project

Run the backend tests:

```bash
python -m pytest backend/tests -q
```

Check TypeScript and build the frontend:

```bash
npx tsc --noEmit
npm run build
```

## Project structure

```text
.
├── backend/
│   ├── app.py                 # FastAPI endpoints
│   ├── requirements.txt       # Python dependencies
│   ├── services/
│   │   ├── worker_finance.py  # Worker demo data and analysis
│   │   ├── ml_engine.py       # Experimental model information
│   │   └── portfolio_engine.py# Aggregate demo portfolio data
│   └── tests/
├── src/
│   ├── App.tsx                # Main React application
│   ├── main.tsx               # Frontend entry point
│   ├── index.css               # Application styles
│   └── lib/
│       └── api.ts              # API client
├── .env.example
├── package.json
└── vite.config.ts
```

## License

No license file was present in this project archive. Contact the project maintainers before reusing or distributing the code.
