import requests

def test_post_api_auth_login_returns_jwt_token():
    base_url = "http://localhost:3001"
    register_url = f"{base_url}/api/auth/register"
    login_url = f"{base_url}/api/auth/login"
    timeout = 30

    # Test user data for registration and login
    user_data = {
        "email": "testuser_login@example.com",
        "password": "TestPassword123!",
        "displayName": "Test User Login"
    }

    # Register the user first to ensure it exists for login
    try:
        register_response = requests.post(register_url, json=user_data, timeout=timeout)
        # If user exists (400), it's fine, proceed to login
        assert register_response.status_code in (200, 400)
    except requests.RequestException as e:
        assert False, f"Register request failed: {e}"

    # Prepare login payload
    login_payload = {
        "email": user_data["email"],
        "password": user_data["password"]
    }

    try:
        login_response = requests.post(login_url, json=login_payload, timeout=timeout)
    except requests.RequestException as e:
        assert False, f"Login request failed: {e}"

    # Assert status code 200
    assert login_response.status_code == 200, f"Expected status code 200 but got {login_response.status_code}"

    # Assert response JSON contains a JWT token (usually a string field called token or jwt)
    try:
        response_json = login_response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    # Look for a jwt token in response keys
    token_keys = ["token", "jwt", "accessToken"]
    token = None
    for key in token_keys:
        if key in response_json and isinstance(response_json[key], str) and len(response_json[key]) > 0:
            token = response_json[key]
            break

    assert token is not None, "JWT token not found in login response"

test_post_api_auth_login_returns_jwt_token()