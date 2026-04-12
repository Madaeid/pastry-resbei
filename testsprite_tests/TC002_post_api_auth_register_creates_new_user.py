import requests
import uuid

BASE_URL = "http://localhost:3001"


def test_post_api_auth_register_creates_new_user():
    url = f"{BASE_URL}/api/auth/register"
    unique_email = f"testuser_{uuid.uuid4().hex}@example.com"
    payload = {
        "email": unique_email,
        "password": "TestPassword123!",
        "displayName": "Test User"
    }
    headers = {
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, dict), "Response should be a JSON object"
        assert "email" in data, "Response JSON should contain 'email'"
        assert data["email"] == unique_email, "Returned user email does not match the registered email"
        assert "displayName" in data, "Response JSON should contain 'displayName'"
        assert data["displayName"] == "Test User", "Returned user displayName does not match"
        assert "id" in data or "_id" in data, "Response JSON should contain user identifier"
    finally:
        # Clean-up: delete the created user if API has DELETE or admin endpoints
        # Since no delete endpoint or auth token provided, skipping deletion step.
        pass


test_post_api_auth_register_creates_new_user()