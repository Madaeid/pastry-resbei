import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def test_get_api_health_returns_service_status():
    url = f"{BASE_URL}/api/health"
    headers = {
        "Accept": "application/json"
    }
    try:
        response = requests.get(url, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request to /api/health failed: {e}"

    assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"
    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not a valid JSON"

    # Validate that the response JSON contains required keys: status, version
    assert isinstance(data, dict), "Response JSON is not an object"
    assert "status" in data, "Missing 'status' in response JSON"
    assert "version" in data, "Missing 'version' in response JSON"

    # Additional checks can be done on the values if needed
    assert isinstance(data["status"], str), "'status' should be a string"
    assert isinstance(data["version"], str), "'version' should be a string"
    # 'uptime' is optional or might be missing in current implementation


test_get_api_health_returns_service_status()