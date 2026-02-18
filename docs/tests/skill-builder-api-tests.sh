#!/bin/bash
# Skill Builder API Endpoint Tests
# Tests all /api/v1/skills/* endpoints via curl
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

echo ""
echo "═══════════════════════════════════════════════"
echo "  SECTION 1: POST /api/v1/skills/analyze"
echo "═══════════════════════════════════════════════"
echo ""

# Test invalid URL
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/skills/analyze" \
  -H "Content-Type: application/json" \
  -d '{"url": "not-a-url"}')
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
check_status "Invalid URL returns 400" "400" "$STATUS" "$BODY"
check_contains "Error has invalid_request code" "$BODY" '"invalid_request"'

# Test missing URL
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/skills/analyze" \
  -H "Content-Type: application/json" \
  -d '{}')
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
check_status "Missing URL returns 400" "400" "$STATUS" "$BODY"

# Test valid analysis (use a known fast site)
echo "  ⏳ Running full analysis on https://www.example.com (this may take 10-30s)..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/skills/analyze" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.example.com"}' \
  --max-time 60)
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
check_status "Analyze example.com returns 201" "201" "$STATUS" "$BODY"
check_contains "Response has id field" "$BODY" '"id"'
check_contains "Response has status field" "$BODY" '"status"'
check_contains "Response has confidence field" "$BODY" '"confidence"'
check_contains "Response has vendor field" "$BODY" '"vendor"'
check_contains "Response has reviewNeeded field" "$BODY" '"reviewNeeded"'

DRAFT_ID=$(echo "$BODY" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); try { console.log(JSON.parse(d).id) } catch { console.log('') }")

echo ""
echo "═══════════════════════════════════════════════"
echo "  SECTION 2: GET /api/v1/skills/drafts"
echo "═══════════════════════════════════════════════"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/skills/drafts")
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
check_status "List drafts returns 200" "200" "$STATUS" "$BODY"
check_contains "Response has drafts array" "$BODY" '"drafts"'
check_contains "Response has total field" "$BODY" '"total"'

TOTAL_DRAFTS=$(echo "$BODY" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); console.log(JSON.parse(d).total)")
if [ "$TOTAL_DRAFTS" -ge 1 ]; then
  pass "At least 1 draft exists (got $TOTAL_DRAFTS)"
else
  fail "At least 1 draft exists" "got $TOTAL_DRAFTS"
fi

# Test status filter
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/skills/drafts?status=pending")
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
check_status "Filter by status=pending returns 200" "200" "$STATUS" "$BODY"

RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/skills/drafts?status=published")
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
check_status "Filter by status=published returns 200" "200" "$STATUS" "$BODY"

echo ""
echo "═══════════════════════════════════════════════"
echo "  SECTION 3: GET /api/v1/skills/drafts/[id]"
echo "═══════════════════════════════════════════════"
echo ""

if [ -n "$DRAFT_ID" ]; then
  RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/skills/drafts/$DRAFT_ID")
  BODY=$(echo "$RESPONSE" | sed '$d')
  STATUS=$(echo "$RESPONSE" | tail -1)
  check_status "Get draft by ID returns 200" "200" "$STATUS" "$BODY"
  check_contains "Draft has vendorData" "$BODY" '"vendorData"'
  check_contains "Draft has confidence" "$BODY" '"confidence"'
  check_contains "Draft has evidence array" "$BODY" '"evidence"'
  check_contains "Draft has status" "$BODY" '"status"'
  check_contains "Draft has reviewNeeded" "$BODY" '"reviewNeeded"'
fi

# Test invalid ID
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/skills/drafts/abc")
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
check_status "Non-numeric ID returns 400" "400" "$STATUS" "$BODY"
check_contains "Error has invalid_id code" "$BODY" '"invalid_id"'

# Test not found
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/skills/drafts/99999")
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
check_status "Nonexistent draft returns 404" "404" "$STATUS" "$BODY"
check_contains "Error has not_found code" "$BODY" '"not_found"'

echo ""
echo "═══════════════════════════════════════════════"
echo "  SECTION 4: PATCH /api/v1/skills/drafts/[id]"
echo "═══════════════════════════════════════════════"
echo ""

if [ -n "$DRAFT_ID" ]; then
  # Update vendor data
  RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH "$BASE_URL/api/v1/skills/drafts/$DRAFT_ID" \
    -H "Content-Type: application/json" \
    -d '{"vendorData": {"name": "Example Corp Updated"}}')
  BODY=$(echo "$RESPONSE" | sed '$d')
  STATUS=$(echo "$RESPONSE" | tail -1)
  check_status "PATCH draft returns 200" "200" "$STATUS" "$BODY"

  # Verify update persisted
  RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/skills/drafts/$DRAFT_ID")
  BODY=$(echo "$RESPONSE" | sed '$d')
  check_contains "Updated name persisted" "$BODY" '"Example Corp Updated"'

  # Update status
  RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH "$BASE_URL/api/v1/skills/drafts/$DRAFT_ID" \
    -H "Content-Type: application/json" \
    -d '{"status": "reviewed"}')
  BODY=$(echo "$RESPONSE" | sed '$d')
  STATUS=$(echo "$RESPONSE" | tail -1)
  check_status "PATCH status to reviewed returns 200" "200" "$STATUS" "$BODY"
fi

# Test invalid update
RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH "$BASE_URL/api/v1/skills/drafts/99999" \
  -H "Content-Type: application/json" \
  -d '{"status": "reviewed"}')
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
check_status "PATCH nonexistent draft returns 404" "404" "$STATUS" "$BODY"

echo ""
echo "═══════════════════════════════════════════════"
echo "  SECTION 5: POST /api/v1/skills/drafts/[id]/publish"
echo "═══════════════════════════════════════════════"
echo ""

if [ -n "$DRAFT_ID" ]; then
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/skills/drafts/$DRAFT_ID/publish")
  BODY=$(echo "$RESPONSE" | sed '$d')
  STATUS=$(echo "$RESPONSE" | tail -1)
  check_status "Publish draft returns 200" "200" "$STATUS" "$BODY"
  check_contains "Response has skillMd" "$BODY" '"skillMd"'
  check_contains "Response status is published" "$BODY" '"published"'

  # Try publishing again
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/skills/drafts/$DRAFT_ID/publish")
  BODY=$(echo "$RESPONSE" | sed '$d')
  STATUS=$(echo "$RESPONSE" | tail -1)
  check_status "Re-publish returns 400 (already published)" "400" "$STATUS" "$BODY"
  check_contains "Error is already_published" "$BODY" '"already_published"'
fi

# Test publish nonexistent
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/skills/drafts/99999/publish")
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
check_status "Publish nonexistent returns 404" "404" "$STATUS" "$BODY"

echo ""
echo "═══════════════════════════════════════════════"
echo "  SECTION 6: DELETE /api/v1/skills/drafts/[id]"
echo "═══════════════════════════════════════════════"
echo ""

# Create a new draft to delete
echo "  ⏳ Creating draft to test deletion..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/skills/analyze" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.example.org"}' \
  --max-time 60)
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
DELETE_ID=$(echo "$BODY" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); try { console.log(JSON.parse(d).id) } catch { console.log('') }")

if [ -n "$DELETE_ID" ]; then
  RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE_URL/api/v1/skills/drafts/$DELETE_ID")
  BODY=$(echo "$RESPONSE" | sed '$d')
  STATUS=$(echo "$RESPONSE" | tail -1)
  check_status "DELETE draft returns 200" "200" "$STATUS" "$BODY"
  check_contains "Delete returns success" "$BODY" '"success"'

  # Verify deleted
  RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/skills/drafts/$DELETE_ID")
  BODY=$(echo "$RESPONSE" | sed '$d')
  STATUS=$(echo "$RESPONSE" | tail -1)
  check_status "Deleted draft returns 404" "404" "$STATUS" "$BODY"
fi

# Test delete nonexistent
RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE_URL/api/v1/skills/drafts/99999")
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
check_status "Delete nonexistent returns 404" "404" "$STATUS" "$BODY"

echo ""
echo "═══════════════════════════════════════════════"
echo "  SECTION 7: Review UI Pages"
echo "═══════════════════════════════════════════════"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/app/skills/review")
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
check_status "GET /app/skills/review returns 200" "200" "$STATUS" "$BODY"

if [ -n "$DRAFT_ID" ]; then
  RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/app/skills/review/$DRAFT_ID")
  BODY=$(echo "$RESPONSE" | sed '$d')
  STATUS=$(echo "$RESPONSE" | tail -1)
  check_status "GET /app/skills/review/$DRAFT_ID returns 200" "200" "$STATUS" "$BODY"
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "  RESULTS"
echo "═══════════════════════════════════════════════"
echo ""
echo "Total: $TOTAL | Passed: $PASS | Failed: $FAIL"
if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "⚠️  $FAIL test(s) failed!"
  exit 1
else
  echo ""
  echo "🎉 All tests passed!"
  exit 0
fi
