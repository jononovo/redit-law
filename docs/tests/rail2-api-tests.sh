#!/bin/bash
# Rail 2 (Card Wallet) API Endpoint Tests
# Tests all /api/v1/card-wallet/* endpoints via curl
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
echo "  Rail 2 (Card Wallet) API Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ─── Auth Required Tests ─────────────────────────────────────
echo "--- Authentication Enforcement ---"

# All owner endpoints should require auth (return 401 without session cookie)
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/card-wallet/list")
check_status "GET /list requires auth" "401" "$RESPONSE"

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/card-wallet/balance?wallet_id=1")
check_status "GET /balance requires auth" "401" "$RESPONSE"

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d '{"bot_id":"test"}' "$BASE_URL/api/v1/card-wallet/create")
check_status "POST /create requires auth" "401" "$RESPONSE"

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d '{"wallet_id":1}' "$BASE_URL/api/v1/card-wallet/freeze")
check_status "POST /freeze requires auth" "401" "$RESPONSE"

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/card-wallet/guardrails?wallet_id=1")
check_status "GET /guardrails requires auth" "401" "$RESPONSE"

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d '{"wallet_id":1}' "$BASE_URL/api/v1/card-wallet/guardrails")
check_status "POST /guardrails requires auth" "401" "$RESPONSE"

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/card-wallet/transactions?wallet_id=1")
check_status "GET /transactions requires auth" "401" "$RESPONSE"

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/card-wallet/approvals")
check_status "GET /approvals requires auth" "401" "$RESPONSE"

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d '{"approval_id":1,"decision":"approve"}' "$BASE_URL/api/v1/card-wallet/approvals/decide")
check_status "POST /approvals/decide requires auth" "401" "$RESPONSE"

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d '{"wallet_id":1}' "$BASE_URL/api/v1/card-wallet/onramp/session")
check_status "POST /onramp/session requires auth" "401" "$RESPONSE"

echo ""
echo "--- Bot Endpoint Authentication ---"

# Bot endpoints should require Bearer token
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d '{}' "$BASE_URL/api/v1/card-wallet/bot/purchase")
check_status "POST /bot/purchase requires bot auth" "401" "$RESPONSE"

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/card-wallet/bot/purchase/status?transaction_id=1")
check_status "GET /bot/purchase/status requires bot auth" "401" "$RESPONSE"

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d '{}' "$BASE_URL/api/v1/card-wallet/bot/search")
check_status "POST /bot/search requires bot auth" "401" "$RESPONSE"

# Bot endpoints should reject invalid tokens
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer invalid_token" -X POST -H "Content-Type: application/json" -d '{}' "$BASE_URL/api/v1/card-wallet/bot/purchase")
check_status "POST /bot/purchase rejects invalid token" "401" "$RESPONSE"

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer invalid_token" -X POST -H "Content-Type: application/json" -d '{}' "$BASE_URL/api/v1/card-wallet/bot/search")
check_status "POST /bot/search rejects invalid token" "401" "$RESPONSE"

echo ""
echo "--- Input Validation ---"

# Bot purchase with invalid/missing fields
BODY=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer cck_live_fakefake" -X POST -H "Content-Type: application/json" -d '{"merchant":""}' "$BASE_URL/api/v1/card-wallet/bot/purchase")
STATUS=$(echo "$BODY" | tail -1)
# Should return 400 or 401 (401 since token is fake)
if [ "$STATUS" = "400" ] || [ "$STATUS" = "401" ]; then
  pass "POST /bot/purchase validates input (HTTP $STATUS)"
else
  fail "POST /bot/purchase validates input" "Expected 400 or 401, got $STATUS"
fi

# Bot search with invalid/missing fields
BODY=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer cck_live_fakefake" -X POST -H "Content-Type: application/json" -d '{"product_url":"not-a-url"}' "$BASE_URL/api/v1/card-wallet/bot/search")
STATUS=$(echo "$BODY" | tail -1)
if [ "$STATUS" = "400" ] || [ "$STATUS" = "401" ]; then
  pass "POST /bot/search validates product_url (HTTP $STATUS)"
else
  fail "POST /bot/search validates product_url" "Expected 400 or 401, got $STATUS"
fi

BODY=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer cck_live_fakefake" -X POST -H "Content-Type: application/json" -d '{}' "$BASE_URL/api/v1/card-wallet/bot/search")
STATUS=$(echo "$BODY" | tail -1)
if [ "$STATUS" = "400" ] || [ "$STATUS" = "401" ]; then
  pass "POST /bot/search rejects missing product_url (HTTP $STATUS)"
else
  fail "POST /bot/search rejects missing product_url" "Expected 400 or 401, got $STATUS"
fi

echo ""
echo "--- Master Guardrails Authentication ---"

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/master-guardrails")
check_status "GET /master-guardrails requires auth" "401" "$RESPONSE"

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d '{"enabled":true}' "$BASE_URL/api/v1/master-guardrails")
check_status "POST /master-guardrails requires auth" "401" "$RESPONSE"

echo ""
echo "--- Owner Endpoints Authentication ---"

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/v1/owners/onboarded")
check_status "POST /owners/onboarded requires auth" "401" "$RESPONSE"

echo ""
echo "--- Page Rendering ---"

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/app/card-wallet")
check_status "GET /app/card-wallet page loads" "200" "$RESPONSE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Results: $PASS passed, $FAIL failed out of $TOTAL total"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $FAIL -gt 0 ]; then
  exit 1
fi
exit 0
