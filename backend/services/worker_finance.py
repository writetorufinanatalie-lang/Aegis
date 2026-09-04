"""Financial resilience engine for one worker session.

Three of the four models below (income_volatility, work_disruption, repayment_resilience) are
transparent, explainable heuristics — not trained ML. The fourth (ml_repayment_risk) is a real
trained scikit-learn classifier from services.ml_engine, kept clearly separate and labelled so
the two kinds of model are never confused. services.automation turns every fresh analysis into
concrete alerts automatically, and services.ml_engine also provides a simple predictive
next-week income forecast."""
import random
import time
from datetime import date, timedelta
from math import pow
from statistics import mean, median, pstdev
from typing import Any

import httpx

_CLIMATE_RETRY_COOLDOWN_SECONDS = 30

from services.automation import generate_alerts
from services.ml_engine import forecast_next_income, predict_repayment_risk


def clamp(value: float, low: float = 0, high: float = 100) -> float:
    return round(max(low, min(high, value)), 1)


def level(value: float, low: float, high: float) -> str:
    return "LOW" if value < low else "MEDIUM" if value < high else "HIGH"


CITY_COORDINATES = {"chennai": (13.0827, 80.2707), "bengaluru": (12.9716, 77.5946), "mumbai": (19.076, 72.8777), "delhi": (28.6139, 77.209)}


class WorkerFinancialEngine:
    def __init__(self):
        self.profile = {"worker_id": "W001", "work_type": "Delivery", "operating_area": "Chennai", "income_frequency": "Weekly", "primary_platform": "Delivery platform", "secondary_income_sources": 1}
        self.survey = {"work_type": "Delivery", "income_frequency": "Weekly", "income_predictability": "Variable", "spending_categories": ["Rent", "Food", "Fuel"], "essential_monthly_expenses": 21000, "current_savings": 8000, "emergency_savings": 8000, "existing_debt": 12000, "existing_emi": 1800, "financial_goal": "Build emergency buffer", "desired_savings_goal": 12000, "borrowing_comfort": "Only for essentials", "financial_concern": "Irregular income", "income_sources": 2}
        self.consent = False
        self.audit: list[str] = []
        self._climate_cache: dict[str, Any] | None = None
        self._climate_is_live: bool = False
        self._climate_attempted_at: float = 0.0
        self._last_analysis: dict[str, Any] | None = None
        self._seed()

    def _seed(self):
        # Randomized per session (not a fixed hardcoded set) — this stands in for a real bank /
        # Account Aggregator transaction feed, which this MVP never connects to. Varying it per
        # session is deliberate: a demo that shows the exact same numbers to every worker reads as
        # fabricated, when the honest description is "synthetic and disclosed as such everywhere
        # it appears" (see the SYNTHETIC DEMO badges throughout the UI and the provenance field
        # on every financial response).
        rng = random.Random()
        self.transactions: list[dict[str, Any]] = []
        today = date.today()
        base = rng.uniform(19000, 33000)
        weekly = [round(base * rng.uniform(0.55, 0.75)), round(base * rng.uniform(0.95, 1.25)), round(base * rng.uniform(0.65, 0.90)), round(base * rng.uniform(1.15, 1.45))]
        for number, amount in enumerate(weekly):
            self.transactions.append({"date": str(today - timedelta(days=(3 - number) * 7)), "amount": amount, "type": "income", "category": "Gig earnings", "source": "Synthetic demo — stands in for a real bank/Account Aggregator feed; no bank is connected in this MVP", "recurring": False})
        essentials = [(25, round(rng.uniform(7500, 10500)), "Rent"), (18, round(rng.uniform(3800, 5200)), "Food"), (12, round(rng.uniform(3000, 4500)), "Fuel"), (7, round(rng.uniform(1800, 2600)), "Utilities"), (3, round(rng.uniform(1800, 3200)), "Discretionary")]
        for days, amount, category in essentials:
            self.transactions.append({"date": str(today - timedelta(days=days)), "amount": -amount, "type": "expense", "category": category, "source": "Synthetic demo", "recurring": category in ("Rent", "Utilities")})

    def set_profile(self, profile: dict[str, Any]):
        self.profile = profile
        self.audit.append("profile_updated")
        return self.profile

    def set_survey(self, survey: dict[str, Any]):
        self.survey = survey
        self.audit.append("survey_updated")

    def weekly_income(self):
        return [item["amount"] for item in self.transactions if item["type"] == "income"]

    def weekly_income_series(self):
        """Chart-ready income history built from this session's actual transactions
        (not hardcoded on the frontend), so it stays correct after a profile change or scenario."""
        entries = sorted((item for item in self.transactions if item["type"] == "income"), key=lambda item: item["date"])
        return [{"week": f"Week {index + 1}", "date": item["date"], "amount": item["amount"]} for index, item in enumerate(entries)]

    def intelligence(self):
        income = self.weekly_income()
        monthly_income = sum(income)
        essential = self.survey["essential_monthly_expenses"]
        discretionary = sum(-item["amount"] for item in self.transactions if item["type"] == "expense" and item["category"] == "Discretionary")
        surplus = monthly_income - essential - discretionary - self.survey["existing_emi"]
        volatility = pstdev(income) / mean(income) if len(income) > 1 and mean(income) else 0
        return {"average_income": round(mean(income)) if income else 0, "median_income": round(median(income)) if income else 0, "income_volatility": round(volatility, 3), "income_trend_pct": round((mean(income[-2:]) - mean(income[:2])) / max(mean(income[:2]), 1) * 100, 1) if len(income) >= 4 else 0, "essential_expenses": essential, "discretionary_expenses": discretionary, "savings_rate_pct": round(max(0, surplus) / max(monthly_income, 1) * 100, 1), "emergency_buffer": self.survey["emergency_savings"], "debt_burden_pct": round(self.survey["existing_emi"] / max(monthly_income, 1) * 100, 1), "repayment_capacity": round(max(0, surplus) * .35), "cash_flow_surplus": round(surplus), "projected_shortfall": round(max(0, -surplus)), "financial_runway_days": round(self.survey["current_savings"] / max(essential / 30, 1), 1), "provenance": "SYNTHETIC / DEMO"}

    def climate(self):
        # A successful live fetch is cached for the rest of the session (weather doesn't need
        # re-fetching every few seconds). A FAILED fetch is cached too, but only for
        # _CLIMATE_RETRY_COOLDOWN_SECONDS — long enough that the several climate() calls inside one
        # /api/decision request (analysis -> models -> borrowing each call it) hit the network once,
        # not three times, but short enough that a transient network blip (venue wifi, a slow DNS
        # lookup) doesn't lock the whole session into "unavailable" forever — the next request after
        # the cooldown gets a fresh attempt at the live forecast.
        if self._climate_cache is not None and (self._climate_is_live or time.time() - self._climate_attempted_at < _CLIMATE_RETRY_COOLDOWN_SECONDS):
            return self._climate_cache
        place = self.profile["operating_area"].strip().lower()
        latitude, longitude = CITY_COORDINATES.get(place, CITY_COORDINATES["chennai"])
        fallback = {"period": "next 72 hours", "area": self.profile["operating_area"], "risk": "MEDIUM", "work_disruption_pct": 15, "possible_income_impact": round(mean(self.weekly_income()) * .15) if self.weekly_income() else 0, "source": "DEMO FALLBACK — weather unavailable", "conditions": "Weather unavailable; using a conservative demo disruption assumption.", "confidence": .35}
        self._climate_attempted_at = time.time()
        try:
            response = httpx.get("https://api.open-meteo.com/v1/forecast", params={"latitude": latitude, "longitude": longitude, "daily": "precipitation_probability_max,precipitation_sum,weathercode", "forecast_days": 3, "timezone": "auto"}, timeout=6.0)
            response.raise_for_status()
            daily = response.json()["daily"]
            probability = max(daily.get("precipitation_probability_max", [0]))
            rainfall = sum(daily.get("precipitation_sum", [0]))
            disruption = clamp(probability * .45 + min(rainfall * 2, 35), 0, 75)
            self._climate_cache = {"period": "next 72 hours", "area": self.profile["operating_area"], "risk": level(disruption, 20, 45), "work_disruption_pct": round(disruption), "possible_income_impact": round(mean(self.weekly_income()) * disruption / 100) if self.weekly_income() else 0, "source": "LIVE — Open-Meteo forecast", "conditions": f"Forecast peak precipitation probability {probability}% with {rainfall:.1f} mm expected over 72 hours.", "confidence": .70, "forecast": {"precipitation_probability_max": probability, "precipitation_sum_mm": rainfall}}
            self._climate_is_live = True
            return self._climate_cache
        except (httpx.HTTPError, KeyError, TypeError, ValueError):
            self._climate_cache = fallback
            self._climate_is_live = False
            return self._climate_cache

    def models(self):
        intelligence, climate = self.intelligence(), self.climate()
        volatility = clamp(intelligence["income_volatility"] * 180)
        disruption = clamp(climate["work_disruption_pct"])
        resilience = clamp(100 - (volatility * .35 + max(0, 30 - intelligence["financial_runway_days"]) * 1.5 + intelligence["debt_burden_pct"] * .7 + disruption * .25))
        ml_risk = predict_repayment_risk(volatility, intelligence["financial_runway_days"], intelligence["debt_burden_pct"], disruption, intelligence["savings_rate_pct"])
        return {"disclosure": "Three explainable heuristic models plus one genuinely trained ML classifier for this MVP. The heuristics are not machine-learning models or credit scores; the classifier is real but trained on synthetic data, not real repayment outcomes.", "income_volatility": {"name": "Income stability model", "score": volatility, "level": level(volatility, 30, 60), "confidence": .70 if len(self.weekly_income()) >= 4 else .40, "inputs": ["four weekly income observations", "income variation"], "method": "deterministic heuristic"}, "work_disruption": {"name": "Weather-to-work disruption model", "score": disruption, "level": level(disruption, 20, 45), "confidence": climate["confidence"], "inputs": ["72-hour precipitation forecast", "delivery work type"], "method": "forecast-to-impact heuristic", "source": climate["source"]}, "repayment_resilience": {"name": "Repayment resilience model", "score": resilience, "level": level(100 - resilience, 35, 65), "confidence": .65, "inputs": ["income stability", "runway", "debt burden", "weather disruption"], "method": "deterministic affordability heuristic"}, "ml_repayment_risk": {"name": ml_risk["name"], "score": round(ml_risk["probability"] * 100, 1), "level": ml_risk["band"], "confidence": ml_risk["holdout_auc"], "inputs": ml_risk["features"], "method": ml_risk["algorithm"], "trained_on": ml_risk["trained_on"], "holdout_accuracy": ml_risk["holdout_accuracy"], "holdout_auc": ml_risk["holdout_auc"], "cross_validation": ml_risk["cross_validation"], "feature_importance": ml_risk["feature_importance"]}}

    def borrowing(self, request: dict[str, Any]):
        intelligence, models, climate = self.intelligence(), self.models(), self.climate()
        monthly_rate, months = request["annual_rate_pct"] / 1200, request["tenure_months"]
        emi = request["amount"] * monthly_rate * pow(1 + monthly_rate, months) / (pow(1 + monthly_rate, months) - 1) if monthly_rate else request["amount"] / months
        safe_capacity = max(0, intelligence["repayment_capacity"] * .8 * (1 - climate["work_disruption_pct"] / 200) * months)
        risk = clamp(emi / max(intelligence["repayment_capacity"], 1) * 55 + (100 - models["repayment_resilience"]["score"]) * .45)
        decision = "DO NOT BORROW" if risk >= 65 or intelligence["financial_runway_days"] < 14 else "CONSIDER ONLY IF ESSENTIAL" if risk >= 35 else "WITHIN DEMO SAFETY BAND"
        return {"credit_requested": request["amount"], "safe_borrowing_capacity": round(safe_capacity), "emi": round(emi), "repayment_burden_pct": round(emi / max(intelligence["average_income"], 1) * 100, 1), "repayment_risk": level(risk, 35, 65), "repayment_risk_score": risk, "decision": decision, "message": "Affordability guidance based on synthetic demo data; not a loan approval or financial advice."}

    def analysis(self):
        intelligence, models, climate = self.intelligence(), self.models(), self.climate()
        borrowing = self.borrowing({"amount": 80000, "annual_rate_pct": 18, "tenure_months": 12})
        scores = {"Income Stability": clamp(100 - models["income_volatility"]["score"]), "Emergency Buffer": clamp(intelligence["financial_runway_days"] / 30 * 100), "Cash-Flow Strength": clamp(50 + intelligence["cash_flow_surplus"] / max(intelligence["essential_expenses"], 1) * 50), "Debt Burden": clamp(100 - intelligence["debt_burden_pct"] * 2), "Weather Resilience": models["repayment_resilience"]["score"]}
        score = round(sum(scores.values()) / len(scores))
        safe_to_save = round(max(0, min(intelligence["cash_flow_surplus"] * .5, intelligence["cash_flow_surplus"] - climate["possible_income_impact"] * .25)))
        action = "PROTECT CASH" if intelligence["financial_runway_days"] < 14 or borrowing["repayment_risk"] == "HIGH" else "SAVE" if safe_to_save >= 500 else "REASSESS"
        ladder = "Fragile" if intelligence["financial_runway_days"] < 7 else "Vulnerable" if intelligence["financial_runway_days"] < 14 else "Building" if intelligence["financial_runway_days"] < 30 else "Resilient"
        next_check = "in 7 days" if action == "PROTECT CASH" else "after your next weekly payout"
        explanation = f"{action}: you have {intelligence['financial_runway_days']} days of runway, {models['income_volatility']['level'].lower()} income variation, and {climate['work_disruption_pct']}% potential weather disruption. Reassess {next_check}."
        result = {"worker": self.profile, "intelligence": intelligence, "models": models, "ml": {"income_volatility": {"level": models["income_volatility"]["level"]}, "income_recovery": {"expected_recovery_weeks": 3}, "repayment_risk": {"probability": models["ml_repayment_risk"]["score"] / 100, "band": models["ml_repayment_risk"]["level"]}}, "climate": climate, "resilience": {"score": score, "ladder": ladder, "financial_runway_days": intelligence["financial_runway_days"], "target_runway_days": 30, "breakdown": scores, "disclaimer": "Internal decision-support metric; not a credit score."}, "safe_to_save": safe_to_save, "safe_to_borrow": borrowing, "weekly_income_series": self.weekly_income_series(), "income_forecast": forecast_next_income(self.weekly_income()), "decision": {"primary_action": action, "explanation": explanation, "next_check": next_check, "ai_mode": "explainable rules engine — not generative AI"}, "recommendations": [{"when": "TODAY", "text": f"Reserve ₹{min(500, self.survey['current_savings']):,.0f} for fuel and food before discretionary spending."}, {"when": "NEXT 72 HOURS", "text": f"Plan for up to ₹{climate['possible_income_impact']:,.0f} in potential weather-related income disruption."}, {"when": "THIS WEEK", "text": "Avoid high-cost credit unless it protects essential work or housing."}, {"when": "CHECK AGAIN", "text": f"Update earnings after your next payout and reassess {next_check}."}], "trace": ["Synthetic income history", "Income stability model", "Weather-to-work disruption model", "Repayment resilience model", "ML repayment-risk classifier", "Runway and essential expenses", action], "disclosure": "Financial inputs are synthetic demo data. Weather may be live when Open-Meteo is available. This is not lending, insurance, or financial advice."}
        result["alerts"] = generate_alerts(result, self._last_analysis)
        self._last_analysis = result
        return result

    def latest_alerts(self):
        return self._last_analysis["alerts"] if self._last_analysis else []

    def simulate(self, scenario: str):
        multiplier = {"income_decrease_10": .9, "income_decrease_30": .7, "income_decrease_50": .5, "income_increase_10": 1.1, "climate_disruption": .8, "unexpected_expense": 1}.get(scenario, 1)
        copy = WorkerFinancialEngine()
        copy.profile, copy.survey, copy.transactions = dict(self.profile), dict(self.survey), [dict(item) for item in self.transactions]
        for item in copy.transactions:
            if item["type"] == "income": item["amount"] = round(item["amount"] * multiplier)
        if scenario == "unexpected_expense": copy.transactions.append({"date": str(date.today()), "amount": -5000, "type": "expense", "category": "Unexpected", "source": "Synthetic scenario", "recurring": False})
        return {"scenario": scenario, "baseline_unchanged": True, "result": copy.analysis()}

    def grant_consent(self):
        self.consent = True
        self.audit.append("consent_granted")
        return self.consent_status()

    def revoke_consent(self):
        self.consent = False
        self.audit.append("consent_revoked")
        return self.consent_status()

    def clear_data(self):
        self.transactions = []
        self.audit.append("financial_data_cleared")
        return {"status": "cleared", "message": "Synthetic session data cleared."}

    def consent_status(self):
        return {"consent": "GRANTED" if self.consent else "NOT GRANTED", "purpose": "Use synthetic financial data for worker resilience guidance.", "data_minimization": True, "audit_events": self.audit[-20:], "never_collected": ["bank passwords", "OTPs", "PINs", "card numbers", "exact location"]}
