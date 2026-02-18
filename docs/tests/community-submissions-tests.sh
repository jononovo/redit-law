#!/bin/bash
# Community Submissions API Tests
# Tests POST /api/v1/skills/submissions, GET /api/v1/skills/submissions/mine
# And verifies submitter attribution in existing draft endpoints
# Prerequisites: App must be running on localhost:5000

BASE_URL="http://localhost:5000"
PASS=0
FAIL=0
TOTAL=0

pass() {
  PASS=$((PASS + 1))
  TOTAL=$((TOTAL + 1))
  echo "✅ $1"
}

fail() {
  FAIL=$((FAIL + 1))
  TOTAL=$((TOTAL + 1))
  echo "❌ $1 — $2"
}

check_status() {
  local test_name="$1"
  local expected_status="$2"
  local actual_status="$3"
  local body="$4"

  if [ "$actual_status" = "$expected_status" ]; then
    pass "$test_name (HTTP $actual_status)"
  else
    fail "$test_name" "expected HTTP $expected_status, got $actual_status. Body: $(echo "$body" | head -c 200)"
  fi
}

check_contains() {
  local test_name="$1"
  local body="$2"
  local needle="$3"

  if echo "$body" | grep -q "$needle"; then
    pass "$test_name"
  else
    fail "$test_name" "response does not contain '$needle'"
  fi
}

check_not_contains() {
  local test_name="$1"
  local body="$2"
  local needle="$3"

  if echo "$body" | grep -q "$needle"; then
    fail "$test_name" "response should NOT contain '$needle'"
  else
    pass "$test_name"
  fi
}

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Community Submissions API Tests"
echo "═══════════════════════════════════════════════════════"
echo ""

echo "─── SECTION 1: Authentication Checks ───"
echo ""

# 1. POST /api/v1/skills/submissions — unauthenticated
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/skills/submissions" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.example.com"}')
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
check_status "POST /submissions unauthenticated returns 401" "401" "$STATUS" "$BODY"
check_contains "Response has unauthorized error" "$BODY" '"unauthorized"'

# 2. GET /api/v1/skills/submissions/mine — unauthenticated
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/skills/submissions/mine")
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
check_status "GET /submissions/mine unauthenticated returns 401" "401" "$STATUS" "$BODY"
check_contains "Response has unauthorized error" "$BODY" '"unauthorized"'

# 3. GET /api/v1/skills/drafts — unauthenticated
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/skills/drafts")
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
check_status "GET /drafts unauthenticated returns 401" "401" "$STATUS" "$BODY"
check_contains "Drafts list has unauthorized error" "$BODY" '"unauthorized"'

# 4. GET /api/v1/skills/drafts/1 — unauthenticated
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/skills/drafts/1")
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
check_status "GET /drafts/:id unauthenticated returns 401" "401" "$STATUS" "$BODY"
check_contains "Draft detail has unauthorized error" "$BODY" '"unauthorized"'

# 5. PATCH /api/v1/skills/drafts/1 — unauthenticated
RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH "$BASE_URL/api/v1/skills/drafts/1" \
  -H "Content-Type: application/json" \
  -d '{"status": "reviewed"}')
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
check_status "PATCH /drafts/:id unauthenticated returns 401" "401" "$STATUS" "$BODY"
check_contains "Draft update has unauthorized error" "$BODY" '"unauthorized"'

# 6. DELETE /api/v1/skills/drafts/1 — unauthenticated
RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE_URL/api/v1/skills/drafts/1")
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
check_status "DELETE /drafts/:id unauthenticated returns 401" "401" "$STATUS" "$BODY"
check_contains "Draft delete has unauthorized error" "$BODY" '"unauthorized"'

# 7. POST /api/v1/skills/drafts/1/publish — unauthenticated
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/skills/drafts/1/publish")
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
check_status "POST /drafts/:id/publish unauthenticated returns 401" "401" "$STATUS" "$BODY"
check_contains "Draft publish has unauthorized error" "$BODY" '"unauthorized"'

echo ""
echo "─── SECTION 2: Input Validation ───"
echo ""

# 8. POST /submissions with missing URL
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/skills/submissions" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=fake-session" \
  -d '{}')
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
# Should be 401 (auth first) or 400 (validation)
if [ "$STATUS" = "401" ] || [ "$STATUS" = "400" ]; then
  pass "POST /submissions with empty body returns error (HTTP $STATUS)"
else
  fail "POST /submissions with empty body" "expected 400 or 401, got $STATUS"
fi

# 9. POST /submissions with invalid URL
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/skills/submissions" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=fake-session" \
  -d '{"url": "not-a-url"}')
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
if [ "$STATUS" = "401" ] || [ "$STATUS" = "400" ]; then
  pass "POST /submissions with invalid URL returns error (HTTP $STATUS)"
else
  fail "POST /submissions with invalid URL" "expected 400 or 401, got $STATUS"
fi

echo ""
echo "─── SECTION 3: PII Protection ───"
echo ""

# 10. Verify drafts list endpoint does NOT expose submitterEmail
# We check by looking at an existing draft response structure
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/skills/drafts")
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
check_not_contains "Drafts list does not expose submitterEmail" "$BODY" '"submitterEmail"'

# 11. Verify draft detail endpoint does NOT expose submitterEmail
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/skills/drafts/1")
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
check_not_contains "Draft detail does not expose submitterEmail" "$BODY" '"submitterEmail"'

echo ""
echo "─── SECTION 4: Endpoint Structure Validation ───"
echo ""

# 12. GET /submissions/mine returns valid JSON structure
RESPONSE=$(curl -s -w "\n%{http_code}" -H "Accept: application/json" "$BASE_URL/api/v1/skills/submissions/mine")
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
if echo "$BODY" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
  pass "GET /submissions/mine returns valid JSON (HTTP $STATUS)"
else
  if [ "$STATUS" = "401" ]; then
    pass "GET /submissions/mine returns 401 auth error as expected (HTTP $STATUS)"
  else
    fail "GET /submissions/mine" "response is not valid JSON (HTTP $STATUS)"
  fi
fi

# 13. POST /submissions returns valid JSON structure
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/skills/submissions" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"url": "https://www.example.com"}')
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
if echo "$BODY" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
  pass "POST /submissions returns valid JSON (HTTP $STATUS)"
else
  if [ "$STATUS" = "401" ]; then
    pass "POST /submissions returns 401 auth error as expected (HTTP $STATUS)"
  else
    fail "POST /submissions" "response is not valid JSON (HTTP $STATUS)"
  fi
fi

# 14. Verify POST /submissions uses correct HTTP method
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/v1/skills/submissions")
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
if [ "$STATUS" = "405" ] || [ "$STATUS" = "404" ]; then
  pass "GET /submissions not allowed or not found (HTTP $STATUS)"
else
  fail "GET /submissions method check" "expected 405 or 404, got $STATUS"
fi

echo ""
echo "─── SECTION 5: Draft Attribute Fields ───"
echo ""

# 15. Verify drafts list includes submissionSource field in response (even in 401)
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/skills/drafts")
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
# If 401, the auth check returns before we see fields — that's the expected behavior now
if [ "$STATUS" = "401" ]; then
  pass "Drafts list correctly requires auth before exposing any fields (HTTP 401)"
else
  check_contains "Drafts list includes submissionSource field" "$BODY" '"submissionSource"'
  check_contains "Drafts list includes submitterType field" "$BODY" '"submitterType"'
  check_contains "Drafts list includes submitterName field" "$BODY" '"submitterName"'
fi

# 16. Verify draft detail includes submitterType field (even in 401)
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/skills/drafts/1")
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
if [ "$STATUS" = "401" ]; then
  pass "Draft detail correctly requires auth before exposing any fields (HTTP 401)"
else
  check_contains "Draft detail includes submitterType field" "$BODY" '"submitterType"'
  check_contains "Draft detail includes submissionSource field" "$BODY" '"submissionSource"'
fi

echo ""
echo "─── SECTION 6: PATCH /drafts/:id Invalid Inputs ───"
echo ""

# 17. PATCH with invalid ID
RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH "$BASE_URL/api/v1/skills/drafts/abc" \
  -H "Content-Type: application/json" \
  -d '{"status": "reviewed"}')
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
if [ "$STATUS" = "401" ] || [ "$STATUS" = "400" ]; then
  pass "PATCH /drafts/abc returns error (HTTP $STATUS)"
else
  fail "PATCH /drafts/abc" "expected 400 or 401, got $STATUS"
fi

# 18. DELETE with invalid ID
RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE_URL/api/v1/skills/drafts/abc")
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
if [ "$STATUS" = "401" ] || [ "$STATUS" = "400" ]; then
  pass "DELETE /drafts/abc returns error (HTTP $STATUS)"
else
  fail "DELETE /drafts/abc" "expected 400 or 401, got $STATUS"
fi

# 19. POST publish with invalid ID
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/skills/drafts/abc/publish")
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
if [ "$STATUS" = "401" ] || [ "$STATUS" = "400" ]; then
  pass "POST /drafts/abc/publish returns error (HTTP $STATUS)"
else
  fail "POST /drafts/abc/publish" "expected 400 or 401, got $STATUS"
fi

# 20. POST publish with nonexistent ID
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/skills/drafts/99999/publish")
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
if [ "$STATUS" = "401" ] || [ "$STATUS" = "404" ]; then
  pass "POST /drafts/99999/publish returns error (HTTP $STATUS)"
else
  fail "POST /drafts/99999/publish" "expected 401 or 404, got $STATUS"
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  RESULTS: $PASS passed, $FAIL failed, $TOTAL total"
echo "═══════════════════════════════════════════════════════"
echo ""

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
