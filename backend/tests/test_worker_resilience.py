"""Contract tests for the current worker-resilience MVP."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient
from app import app

client = TestClient(app)


def login():
    response = client.post("/api/auth/login", json={"worker_id": "W001", "password": "demo123"})
    assert response.status_code == 200
    return {"X-AEGIS-Session": response.json()["session"]}


def test_health_and_authentication_boundary():
    assert client.get("/api/health").json()["status"] == "ok"
    assert client.get("/api/decision").status_code == 401
    assert client.post("/api/auth/login", json={"worker_id": "W001", "password": "wrong"}).status_code == 401


def test_decision_has_three_heuristics_plus_one_trained_model():
    response = client.get("/api/decision", headers=login())
    assert response.status_code == 200
    payload = response.json()
    assert set(payload["models"]) >= {"income_volatility", "work_disruption", "repayment_resilience", "ml_repayment_risk"}
    assert "genuinely trained ML classifier" in payload["models"]["disclosure"]
    ml_model = payload["models"]["ml_repayment_risk"]
    assert ml_model["method"] == "GradientBoostingClassifier (scikit-learn)"
    assert 0 <= ml_model["holdout_auc"] <= 1
    assert payload["decision"]["next_check"]
    assert payload["disclosure"].startswith("Financial inputs are synthetic")
    assert payload["income_forecast"]["forecast_next_week"] >= 0
    assert isinstance(payload["alerts"], list) and len(payload["alerts"]) >= 1


def test_alerts_endpoint_and_automation():
    headers = login()
    client.get("/api/decision", headers=headers)  # populate latest_alerts
    response = client.get("/api/alerts", headers=headers)
    assert response.status_code == 200
    assert isinstance(response.json()["alerts"], list)


def test_sessions_are_isolated_from_each_other():
    session_a, session_b = login(), login()
    assert session_a["X-AEGIS-Session"] != session_b["X-AEGIS-Session"]
    # A token from one login cannot be reused to authenticate as a fabricated / unrelated token.
    assert client.get("/api/worker/profile", headers={"X-AEGIS-Session": "not-a-real-token"}).status_code == 401
    assert client.get("/api/worker/profile", headers={"X-AEGIS-Session": ""}).status_code == 401
    # Logging out one session must not affect the other.
    client.post("/api/auth/logout", headers=session_a)
    assert client.get("/api/worker/profile", headers=session_a).status_code == 401
    assert client.get("/api/worker/profile", headers=session_b).status_code == 200


def test_business_api_is_a_separate_credential_and_never_returns_individual_records():
    # A worker session token must not grant access to the business API.
    worker_headers = login()
    assert client.get("/api/business/portfolio-summary", headers={"X-AEGIS-Business-Key": worker_headers["X-AEGIS-Session"]}).status_code == 401
    assert client.get("/api/business/portfolio-summary").status_code == 401
    demo_key = client.get("/api/business/demo-key").json()["demo_api_key"]
    response = client.get("/api/business/portfolio-summary", headers={"X-AEGIS-Business-Key": demo_key})
    assert response.status_code == 200
    payload = response.json()
    assert payload["portfolio_size"] > 0
    # Structural privacy guarantee: no per-record identifying keys anywhere in the aggregate response
    # (checked by actual JSON key, not by substring, since the disclosure text legitimately says "profile").
    def collect_keys(node):
        if isinstance(node, dict):
            for key, value in node.items():
                yield key.lower()
                yield from collect_keys(value)
        elif isinstance(node, list):
            for item in node:
                yield from collect_keys(item)
    keys = set(collect_keys(payload))
    assert keys.isdisjoint({"worker_id", "name", "transactions", "profile", "date"})
    # And the business key must not grant access to any individual worker session.
    assert client.get("/api/decision", headers={"X-AEGIS-Session": demo_key}).status_code == 401


def test_borrowing_and_simulation_are_session_scoped():
    headers = login()
    borrowing = client.post("/api/borrowing", headers=headers, json={"amount": 80000, "annual_rate_pct": 18, "tenure_months": 12})
    assert borrowing.status_code == 200
    assert borrowing.json()["emi"] > 0
    baseline = client.get("/api/decision", headers=headers).json()["resilience"]["score"]
    scenario = client.post("/api/simulation", headers=headers, json={"scenario": "income_decrease_30"})
    assert scenario.status_code == 200
    assert scenario.json()["baseline_unchanged"] is True
    assert scenario.json()["result"]["resilience"]["score"] <= baseline


def test_input_validation_and_data_disclosure():
    headers = login()
    assert client.post("/api/borrowing", headers=headers, json={"amount": -1, "annual_rate_pct": 18, "tenure_months": 12}).status_code == 422
    financial_data = client.get("/api/financial/data", headers=headers).json()
    assert financial_data["provenance"] == "SYNTHETIC / DEMO"
    assert financial_data["credentials_collected"] is False
    assert "password" not in str(financial_data).lower()
