"""Rule-based automation: turns a freshly computed analysis into concrete alerts automatically,
so a worker does not have to notice a change themselves. Runs on every /api/decision call —
nothing here waits for a person to click anything."""
from typing import Any, Optional


def generate_alerts(current: dict[str, Any], previous: Optional[dict[str, Any]]) -> list[dict[str, Any]]:
    alerts: list[dict[str, Any]] = []
    intelligence, climate, resilience, decision = current["intelligence"], current["climate"], current["resilience"], current["decision"]

    if intelligence["financial_runway_days"] < 7:
        alerts.append({"level": "CRITICAL", "title": "Very low cash runway", "text": f"Only {intelligence['financial_runway_days']} days of essential expenses are covered. Protect cash today."})
    elif intelligence["financial_runway_days"] < 14:
        alerts.append({"level": "WARNING", "title": "Cash runway below two weeks", "text": f"{intelligence['financial_runway_days']} days of runway remain. Avoid new borrowing this week."})

    if climate["risk"] == "HIGH":
        alerts.append({"level": "WARNING", "title": "High weather disruption risk", "text": f"Up to {climate['work_disruption_pct']}% of work hours may be disrupted in the next 72 hours ({climate['source']})."})

    if current["safe_to_borrow"]["repayment_risk"] == "HIGH":
        alerts.append({"level": "WARNING", "title": "Borrowing would be risky right now", "text": "Estimated repayment risk is high at current income and expenses — avoid new credit unless essential."})

    if previous:
        prev_score = previous.get("resilience", {}).get("score")
        if prev_score is not None and resilience["score"] <= prev_score - 10:
            alerts.append({"level": "WARNING", "title": "Resilience score dropped", "text": f"Score fell from {prev_score} to {resilience['score']} since your last check."})
        elif prev_score is not None and resilience["score"] >= prev_score + 10:
            alerts.append({"level": "INFO", "title": "Resilience score improved", "text": f"Score rose from {prev_score} to {resilience['score']} since your last check."})
        prev_action = previous.get("decision", {}).get("primary_action")
        if prev_action and prev_action != decision["primary_action"]:
            alerts.append({"level": "INFO", "title": "Recommendation changed", "text": f"Your recommended action changed from {prev_action} to {decision['primary_action']}."})

    if not alerts:
        alerts.append({"level": "INFO", "title": "No urgent changes", "text": "Your resilience position is stable since the last check."})
    return alerts
