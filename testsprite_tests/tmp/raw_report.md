
# TestSprite AI Testing Report(MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** my resipe
- **Date:** 2026-04-04
- **Prepared by:** TestSprite AI Team

---

## 2️⃣ Requirement Validation Summary

#### Test TC001 get api health returns service status
- **Test Code:** [TC001_get_api_health_returns_service_status.py](./TC001_get_api_health_returns_service_status.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 33, in <module>
  File "<string>", line 25, in test_get_api_health_returns_service_status
AssertionError: Missing 'version' in response JSON

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/8fabe71e-326f-4b28-befc-6c0d1d585d17/e4e30765-b380-44d9-a7e4-628366903834
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC002 post api auth register creates new user
- **Test Code:** [TC002_post_api_auth_register_creates_new_user.py](./TC002_post_api_auth_register_creates_new_user.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 35, in <module>
  File "<string>", line 21, in test_post_api_auth_register_creates_new_user
AssertionError: Expected status code 200, got 400

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/8fabe71e-326f-4b28-befc-6c0d1d585d17/4d138318-ab56-4792-9e30-fa7d226d1319
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC003 post api auth login returns jwt token
- **Test Code:** [TC003_post_api_auth_login_returns_jwt_token.py](./TC003_post_api_auth_login_returns_jwt_token.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 54, in <module>
  File "<string>", line 36, in test_post_api_auth_login_returns_jwt_token
AssertionError: Expected status code 200 but got 400

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/8fabe71e-326f-4b28-befc-6c0d1d585d17/97432672-945e-494a-a90a-beb03bbb4095
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---


## 3️⃣ Coverage & Matching Metrics

- **0.00** of tests passed

| Requirement        | Total Tests | ✅ Passed | ❌ Failed  |
|--------------------|-------------|-----------|------------|
| ...                | ...         | ...       | ...        |
---


## 4️⃣ Key Gaps / Risks
{AI_GNERATED_KET_GAPS_AND_RISKS}
---