#!/bin/bash
# Rail 5 (Sub-Agent Cards) API Endpoint Tests
# Tests all /api/v1/rail5/* and /api/v1/bot/rail5/* endpoints via curl
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
    fail "$test_name" "Expected HTTP $expected_status, got $actual_status. Body: $body"
  fi
}

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Rail 5 (Sub-Agent Cards) API Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ─── Owner Endpoint Auth Enforcement ─────────────────────────
echo "--- Owner Endpoint Authentication ---"

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/rail5/cards")
check_status "GET /rail5/cards requires auth" "401" "$RESPONSE"

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d '{"card_name":"test"}' "$BASE_URL/api/v1/rail5/initialize")
check_status "POST /rail5/initialize requires auth" "401" "$RESPONSE"

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d '{"card_id":"test","key_hex":"abc"}' "$BASE_URL/api/v1/rail5/submit-key")
check_status "POST /rail5/submit-key requires auth" "401" "$RESPONSE"

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/rail5/cards/nonexistent-card-id")
check_status "GET /rail5/cards/:id requires auth" "401" "$RESPONSE"

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH -H "Content-Type: application/json" -d '{"status":"frozen"}' "$BASE_URL/api/v1/rail5/cards/nonexistent-card-id")
check_status "PATCH /rail5/cards/:id requires auth" "401" "$RESPONSE"

echo ""
echo "--- Bot Endpoint Authentication ---"

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d '{}' "$BASE_URL/api/v1/bot/rail5/checkout")
check_status "POST /bot/rail5/checkout requires bot auth" "401" "$RESPONSE"

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d '{}' "$BASE_URL/api/v1/bot/rail5/key")
check_status "POST /bot/rail5/key requires bot auth" "401" "$RESPONSE"

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d '{}' "$BASE_URL/api/v1/bot/rail5/confirm")
check_status "POST /bot/rail5/confirm requires bot auth" "401" "$RESPONSE"

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/bot/rail5/checkout/status?checkout_id=test")
check_status "GET /bot/rail5/checkout/status requires bot auth" "401" "$RESPONSE"

echo ""
echo "--- Bot Endpoints Reject Invalid Tokens ---"

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer invalid_token" -X POST -H "Content-Type: application/json" -d '{}' "$BASE_URL/api/v1/bot/rail5/checkout")
check_status "POST /bot/rail5/checkout rejects invalid token" "401" "$RESPONSE"

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer invalid_token" -X POST -H "Content-Type: application/json" -d '{}' "$BASE_URL/api/v1/bot/rail5/key")
check_status "POST /bot/rail5/key rejects invalid token" "401" "$RESPONSE"

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer invalid_token" -X POST -H "Content-Type: application/json" -d '{}' "$BASE_URL/api/v1/bot/rail5/confirm")
check_status "POST /bot/rail5/confirm rejects invalid token" "401" "$RESPONSE"

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer invalid_token" "$BASE_URL/api/v1/bot/rail5/checkout/status?checkout_id=test")
check_status "GET /bot/rail5/checkout/status rejects invalid token" "401" "$RESPONSE"

echo ""
echo "--- Bot Input Validation (with fake token) ---"

BODY=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer cck_live_fakefake" -X POST -H "Content-Type: application/json" -d '{}' "$BASE_URL/api/v1/bot/rail5/checkout")
STATUS=$(echo "$BODY" | tail -1)
if [ "$STATUS" = "400" ] || [ "$STATUS" = "401" ]; then
  pass "POST /bot/rail5/checkout validates empty body (HTTP $STATUS)"
else
  fail "POST /bot/rail5/checkout validates empty body" "Expected 400 or 401, got $STATUS"
fi

BODY=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer cck_live_fakefake" -X POST -H "Content-Type: application/json" -d '{"checkout_id":""}' "$BASE_URL/api/v1/bot/rail5/key")
STATUS=$(echo "$BODY" | tail -1)
if [ "$STATUS" = "400" ] || [ "$STATUS" = "401" ]; then
  pass "POST /bot/rail5/key validates empty checkout_id (HTTP $STATUS)"
else
  fail "POST /bot/rail5/key validates empty checkout_id" "Expected 400 or 401, got $STATUS"
fi

BODY=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer cck_live_fakefake" -X POST -H "Content-Type: application/json" -d '{}' "$BASE_URL/api/v1/bot/rail5/confirm")
STATUS=$(echo "$BODY" | tail -1)
if [ "$STATUS" = "400" ] || [ "$STATUS" = "401" ]; then
  pass "POST /bot/rail5/confirm validates empty body (HTTP $STATUS)"
else
  fail "POST /bot/rail5/confirm validates empty body" "Expected 400 or 401, got $STATUS"
fi

BODY=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer cck_live_fakefake" "$BASE_URL/api/v1/bot/rail5/checkout/status")
STATUS=$(echo "$BODY" | tail -1)
if [ "$STATUS" = "400" ] || [ "$STATUS" = "401" ]; then
  pass "GET /bot/rail5/checkout/status validates missing checkout_id (HTTP $STATUS)"
else
  fail "GET /bot/rail5/checkout/status validates missing checkout_id" "Expected 400 or 401, got $STATUS"
fi

echo ""
echo "--- Page Rendering ---"

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/app/sub-agent-cards")
check_status "GET /app/sub-agent-cards page loads" "200" "$RESPONSE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Results: $PASS passed, $FAIL failed out of $TOTAL total"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $FAIL -gt 0 ]; then
  exit 1
fi
exit 0
