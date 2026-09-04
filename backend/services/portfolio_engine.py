"""Business/lender-facing analytics — aggregated only, by construction.

This module never touches the `sessions` dict in app.py (the live worker sessions) and never
generates or reads any individual worker's real profile or transactions. It builds its own
synthetic portfolio of anonymous demo entries (no name, no worker_id, no transaction-level
detail — those fields are never generated in the first place, so there is nothing to leak) and
only ever returns counts, percentages, and sums across the whole portfolio. There is
deliberately no endpoint anywhere that returns one entry at a time.
"""
from __future__ import annotations

import random
from typing import Any

_WORK_TYPES = ["Delivery", "Driving", "Domestic work", "Retail", "Freelance"]
_CITIES = ["Chennai", "Bengaluru", "Mumbai", "Delhi"]
_PORTFOLIO_SIZE = 240
_SEED = 2026


def _ladder(runway_days: float) -> str:
    return "Fragile" if runway_days < 7 else "Vulnerable" if runway_days < 14 else "Building" if runway_days < 30 else "Resilient"


def _generate_portfolio(n: int, seed: int) -> list[dict[str, Any]]:
    rng = random.Random(seed)
    entries = []
    for _ in range(n):
        work_type, city = rng.choice(_WORK_TYPES), rng.choice(_CITIES)
        weekly_income = max(3000, rng.gauss(9500, 4200))
        volatility = max(0.05, min(0.9, rng.gauss(0.35, 0.15)))
        runway = max(0, rng.gauss(16, 9))
        debt_burden = max(0, min(70, rng.gauss(18, 12)))
        weather_risk_pct = max(0, min(75, rng.gauss(22, 14)))
        savings_rate = max(0, min(55, rng.gauss(20, 12)))
        resilience = max(0, min(100, round(100 - (volatility * 100 * 0.35 + max(0, 30 - runway) * 1.5 + debt_burden * 0.7 + weather_risk_pct * 0.25))))
        repayment_capacity = max(0, weekly_income * 4 * 0.2 * (1 - debt_burden / 100))
        repayment_risk = "HIGH" if resilience < 40 or runway < 10 else "MEDIUM" if resilience < 65 else "LOW"
        # No identifying fields are ever generated: no name, no worker_id, no transaction log.
        entries.append({"work_type": work_type, "city": city, "resilience_score": resilience, "ladder": _ladder(runway), "financial_runway_days": round(runway, 1), "weather_risk": "HIGH" if weather_risk_pct >= 45 else "MEDIUM" if weather_risk_pct >= 20 else "LOW", "repayment_risk": repayment_risk, "safe_borrowing_capacity": round(repayment_capacity)})
    return entries


_PORTFOLIO = _generate_portfolio(_PORTFOLIO_SIZE, _SEED)


def _distribution(values: list[str]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for value in values:
        counts[value] = counts.get(value, 0) + 1
    return counts


def portfolio_summary() -> dict[str, Any]:
    n = len(_PORTFOLIO)
    resilience_scores = [entry["resilience_score"] for entry in _PORTFOLIO]
    runway_days = [entry["financial_runway_days"] for entry in _PORTFOLIO]
    ladder_dist = _distribution([entry["ladder"] for entry in _PORTFOLIO])
    repayment_dist = _distribution([entry["repayment_risk"] for entry in _PORTFOLIO])
    weather_dist = _distribution([entry["weather_risk"] for entry in _PORTFOLIO])
    by_work_type: dict[str, dict[str, Any]] = {}
    for work_type in _WORK_TYPES:
        cohort = [entry for entry in _PORTFOLIO if entry["work_type"] == work_type]
        if not cohort:
            continue
        by_work_type[work_type] = {"count": len(cohort), "average_resilience": round(sum(e["resilience_score"] for e in cohort) / len(cohort), 1)}
    safe_to_lend_total = sum(entry["safe_borrowing_capacity"] for entry in _PORTFOLIO if entry["repayment_risk"] != "HIGH")
    return {
        "portfolio_size": n,
        "provenance": "SYNTHETIC DEMO PORTFOLIO — anonymized and aggregated only; no individual worker profile, transaction, or identifying field exists in this dataset or response.",
        "average_resilience_score": round(sum(resilience_scores) / n, 1),
        "median_resilience_score": sorted(resilience_scores)[n // 2],
        "average_runway_days": round(sum(runway_days) / n, 1),
        "resilience_band_distribution": {band: {"count": count, "pct": round(count / n * 100, 1)} for band, count in ladder_dist.items()},
        "repayment_risk_distribution": {band: {"count": count, "pct": round(count / n * 100, 1)} for band, count in repayment_dist.items()},
        "weather_exposure_distribution": {band: {"count": count, "pct": round(count / n * 100, 1)} for band, count in weather_dist.items()},
        "by_work_type": by_work_type,
        "aggregate_safe_lending_capacity": safe_to_lend_total,
        "pct_needing_intervention": round(len([r for r in runway_days if r < 14]) / n * 100, 1),
    }
