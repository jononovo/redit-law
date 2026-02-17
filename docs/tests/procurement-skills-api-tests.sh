#!/bin/bash
# Procurement Skills API Endpoint Tests
# Tests all /api/v1/bot/skills/* endpoints via curl
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

check_json_field() {
  local test_name="$1"
  local json="$2"
  local field="$3"
  local expected="$4"

  local actual
  actual=$(echo "$json" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); try { const j=JSON.parse(d); const keys='$field'.split('.'); let v=j; for(const k of keys) v=v[k]; console.log(v); } catch(e) { console.log('PARSE_ERROR'); }")

  if [ "$actual" = "$expected" ]; then
    pass "$test_name"
  else
    fail "$test_name" "expected '$expected', got '$actual'"
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
echo "  SECTION 1: GET /api/v1/bot/skills (list all)"
echo "═══════════════════════════════════════════════"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/bot/skills")
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)

check_status "List all vendors returns 200" "200" "$STATUS" "$BODY"

TOTAL_VENDORS=$(echo "$BODY" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); console.log(JSON.parse(d).total)")
if [ "$TOTAL_VENDORS" -ge 14 ]; then
  pass "Response contains 14+ vendors (got $TOTAL_VENDORS)"
else
  fail "Response contains 14+ vendors" "got $TOTAL_VENDORS"
fi

check_contains "Response has 'vendors' array" "$BODY" '"vendors"'
check_contains "Response has 'total' field" "$BODY" '"total"'
check_contains "Response has 'categories' array" "$BODY" '"categories"'

FIRST_VENDOR=$(echo "$BODY" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const v=JSON.parse(d).vendors[0]; console.log(Object.keys(v).sort().join(','))")
for FIELD in agent_friendliness,bulk_pricing,capabilities,catalog_url,category,checkout_methods,free_shipping_above,guest_checkout,last_verified,maturity,name,skill_url,slug,success_rate,url,version; do
  IFS=',' read -ra EXPECTED_FIELDS <<< "$FIELD"
done
check_contains "Vendor object has slug field" "$BODY" '"slug"'
check_contains "Vendor object has name field" "$BODY" '"name"'
check_contains "Vendor object has checkout_methods field" "$BODY" '"checkout_methods"'
check_contains "Vendor object has capabilities field" "$BODY" '"capabilities"'
check_contains "Vendor object has agent_friendliness field" "$BODY" '"agent_friendliness"'
check_contains "Vendor object has skill_url field" "$BODY" '"skill_url"'
check_contains "Vendor object has catalog_url field" "$BODY" '"catalog_url"'
check_contains "Vendor object has success_rate field" "$BODY" '"success_rate"'

echo ""
echo "═══════════════════════════════════════════════"
echo "  SECTION 2: Category Filtering"
echo "═══════════════════════════════════════════════"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/bot/skills?category=hardware")
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)

check_status "Filter by category=hardware returns 200" "200" "$STATUS" "$BODY"

HW_COUNT=$(echo "$BODY" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); console.log(JSON.parse(d).total)")
if [ "$HW_COUNT" -ge 2 ]; then
  pass "Hardware category has 2+ vendors (got $HW_COUNT)"
else
  fail "Hardware category has 2+ vendors" "got $HW_COUNT"
fi

ALL_HARDWARE=$(echo "$BODY" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const v=JSON.parse(d).vendors; console.log(v.every(x=>x.category==='hardware'))")
if [ "$ALL_HARDWARE" = "true" ]; then
  pass "All results are hardware category"
else
  fail "All results are hardware category" "found non-hardware vendors"
fi

RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/bot/skills?category=retail")
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
check_status "Filter by category=retail returns 200" "200" "$STATUS" "$BODY"
check_contains "Retail category includes Amazon" "$BODY" '"amazon"'

RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/bot/skills?category=nonexistent")
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
check_status "Nonexistent category returns 200 with empty results" "200" "$STATUS" "$BODY"
check_json_field "Nonexistent category returns total=0" "$BODY" "total" "0"

echo ""
echo "═══════════════════════════════════════════════"
echo "  SECTION 3: Search Filtering"
echo "═══════════════════════════════════════════════"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/bot/skills?search=amazon")
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
check_status "Search for 'amazon' returns 200" "200" "$STATUS" "$BODY"

AMAZON_COUNT=$(echo "$BODY" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); console.log(JSON.parse(d).total)")
if [ "$AMAZON_COUNT" -ge 2 ]; then
  pass "Search 'amazon' returns 2+ results (Amazon + Amazon Business) — got $AMAZON_COUNT"
else
  fail "Search 'amazon' returns 2+ results" "got $AMAZON_COUNT"
fi

RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/bot/skills?search=AMAZON")
BODY=$(echo "$RESPONSE" | sed '$d')
UPPER_COUNT=$(echo "$BODY" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); console.log(JSON.parse(d).total)")
if [ "$UPPER_COUNT" = "$AMAZON_COUNT" ]; then
  pass "Search is case-insensitive (AMAZON = amazon)"
else
  fail "Search is case-insensitive" "AMAZON got $UPPER_COUNT, amazon got $AMAZON_COUNT"
fi

RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/bot/skills?search=zzz-no-match-xyz")
BODY=$(echo "$RESPONSE" | sed '$d')
check_json_field "Search with no match returns total=0" "$BODY" "total" "0"

echo ""
echo "═══════════════════════════════════════════════"
echo "  SECTION 4: Checkout Method Filtering"
echo "═══════════════════════════════════════════════"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/bot/skills?checkout=native_api")
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
check_status "Filter by checkout=native_api returns 200" "200" "$STATUS" "$BODY"

API_COUNT=$(echo "$BODY" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); console.log(JSON.parse(d).total)")
if [ "$API_COUNT" -ge 1 ]; then
  pass "native_api filter returns 1+ vendors (got $API_COUNT)"
else
  fail "native_api filter returns 1+ vendors" "got $API_COUNT"
fi

ALL_HAVE_API=$(echo "$BODY" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const v=JSON.parse(d).vendors; console.log(v.every(x=>x.checkout_methods.includes('native_api')))")
if [ "$ALL_HAVE_API" = "true" ]; then
  pass "All native_api results have native_api in checkout_methods"
else
  fail "All native_api results have native_api" "found vendor without native_api"
fi

RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/bot/skills?checkout=x402")
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
check_status "Filter by checkout=x402 returns 200 (may be empty)" "200" "$STATUS" "$BODY"

echo ""
echo "═══════════════════════════════════════════════"
echo "  SECTION 5: Capability Filtering"
echo "═══════════════════════════════════════════════"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/bot/skills?capability=bulk_pricing")
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
check_status "Filter by capability=bulk_pricing returns 200" "200" "$STATUS" "$BODY"

BULK_COUNT=$(echo "$BODY" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); console.log(JSON.parse(d).total)")
if [ "$BULK_COUNT" -ge 1 ]; then
  pass "bulk_pricing filter returns 1+ vendors (got $BULK_COUNT)"
else
  fail "bulk_pricing filter returns 1+ vendors" "got $BULK_COUNT"
fi

RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/bot/skills?capability=bulk_pricing,tax_exemption")
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
check_status "Multi-capability filter (bulk_pricing,tax_exemption) returns 200" "200" "$STATUS" "$BODY"

MULTI_COUNT=$(echo "$BODY" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); console.log(JSON.parse(d).total)")
if [ "$MULTI_COUNT" -le "$BULK_COUNT" ]; then
  pass "Multi-capability AND filter narrows results ($MULTI_COUNT <= $BULK_COUNT)"
else
  fail "Multi-capability AND filter narrows results" "$MULTI_COUNT > $BULK_COUNT"
fi

ALL_HAVE_BOTH=$(echo "$BODY" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const v=JSON.parse(d).vendors; console.log(v.every(x=>x.capabilities.includes('bulk_pricing')&&x.capabilities.includes('tax_exemption')))")
if [ "$ALL_HAVE_BOTH" = "true" ]; then
  pass "Multi-capability results all have both capabilities"
else
  fail "Multi-capability results all have both capabilities" "found vendor missing a capability"
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "  SECTION 6: Maturity Filtering"
echo "═══════════════════════════════════════════════"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/bot/skills?maturity=verified")
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
check_status "Filter by maturity=verified returns 200" "200" "$STATUS" "$BODY"

ALL_VERIFIED=$(echo "$BODY" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const v=JSON.parse(d).vendors; console.log(v.every(x=>x.maturity==='verified'))")
if [ "$ALL_VERIFIED" = "true" ]; then
  pass "All maturity=verified results have verified maturity"
else
  fail "All maturity=verified results have verified maturity" "found non-verified vendor"
fi

RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/bot/skills?maturity=beta")
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
check_status "Filter by maturity=beta returns 200" "200" "$STATUS" "$BODY"

echo ""
echo "═══════════════════════════════════════════════"
echo "  SECTION 7: Combined Filters"
echo "═══════════════════════════════════════════════"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/bot/skills?category=retail&checkout=native_api")
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
check_status "Combined category+checkout filter returns 200" "200" "$STATUS" "$BODY"

COMBINED_VALID=$(echo "$BODY" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const v=JSON.parse(d).vendors; console.log(v.every(x=>x.category==='retail'&&x.checkout_methods.includes('native_api')))")
if [ "$COMBINED_VALID" = "true" ]; then
  pass "Combined filter results satisfy both constraints"
else
  fail "Combined filter results satisfy both constraints" "found vendor not matching both filters"
fi

RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/bot/skills?search=amazon&capability=bulk_pricing")
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
check_status "Combined search+capability filter returns 200" "200" "$STATUS" "$BODY"
check_contains "Amazon Business appears in bulk_pricing+amazon search" "$BODY" '"amazon-business"'

echo ""
echo "═══════════════════════════════════════════════"
echo "  SECTION 8: GET /api/v1/bot/skills/[vendor]"
echo "═══════════════════════════════════════════════"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/bot/skills/amazon")
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)

check_status "GET /api/v1/bot/skills/amazon returns 200" "200" "$STATUS" "$BODY"
if echo "$BODY" | head -1 | grep -q "^---"; then
  pass "Amazon SKILL.md has YAML frontmatter"
else
  fail "Amazon SKILL.md has YAML frontmatter" "first line is not ---"
fi
check_contains "Amazon SKILL.md has name field" "$BODY" "name: creditclaw-shop-amazon"
check_contains "Amazon SKILL.md has maturity field" "$BODY" "maturity: verified"
check_contains "Amazon SKILL.md has Shopping heading" "$BODY" "# Shopping at Amazon"
check_contains "Amazon SKILL.md has Store URL" "$BODY" "https://www.amazon.com"
check_contains "Amazon SKILL.md has Checkout Methods section" "$BODY" "## Checkout Methods"
check_contains "Amazon SKILL.md has How to Search section" "$BODY" "## How to Search"
check_contains "Amazon SKILL.md has How to Checkout section" "$BODY" "## How to Checkout"
check_contains "Amazon SKILL.md has Shipping section" "$BODY" "## Shipping"
check_contains "Amazon SKILL.md has Tips section" "$BODY" "## Tips"
check_contains "Amazon SKILL.md has Metadata section" "$BODY" "## Metadata"
check_contains "Amazon SKILL.md has success rate" "$BODY" "Success Rate"

CONTENT_TYPE=$(curl -s -o /dev/null -w "%{content_type}" "$BASE_URL/api/v1/bot/skills/amazon")
if echo "$CONTENT_TYPE" | grep -q "text/markdown"; then
  pass "Content-Type is text/markdown"
else
  fail "Content-Type is text/markdown" "got $CONTENT_TYPE"
fi

SKILL_VERSION=$(curl -s -o /dev/null -D - "$BASE_URL/api/v1/bot/skills/amazon" 2>/dev/null | grep -i "x-skill-version" | tr -d '\r')
if echo "$SKILL_VERSION" | grep -qi "x-skill-version"; then
  pass "X-Skill-Version header is present"
else
  fail "X-Skill-Version header is present" "header missing"
fi

SKILL_MATURITY=$(curl -s -o /dev/null -D - "$BASE_URL/api/v1/bot/skills/amazon" 2>/dev/null | grep -i "x-skill-maturity" | tr -d '\r')
if echo "$SKILL_MATURITY" | grep -qi "x-skill-maturity"; then
  pass "X-Skill-Maturity header is present"
else
  fail "X-Skill-Maturity header is present" "header missing"
fi

CACHE_CONTROL=$(curl -s -o /dev/null -D - "$BASE_URL/api/v1/bot/skills/amazon" 2>/dev/null | grep -i "cache-control" | tr -d '\r')
if echo "$CACHE_CONTROL" | grep -qi "public"; then
  pass "Cache-Control includes 'public'"
else
  fail "Cache-Control includes 'public'" "got $CACHE_CONTROL"
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "  SECTION 9: Multiple Vendor SKILL.md"
echo "═══════════════════════════════════════════════"
echo ""

for VENDOR in staples home-depot lowes grainger newegg bh-photo; do
  RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/bot/skills/$VENDOR")
  BODY=$(echo "$RESPONSE" | sed '$d')
  STATUS=$(echo "$RESPONSE" | tail -1)
  if [ "$STATUS" = "200" ] && echo "$BODY" | grep -q "^---"; then
    pass "GET /api/v1/bot/skills/$VENDOR returns valid SKILL.md"
  else
    fail "GET /api/v1/bot/skills/$VENDOR returns valid SKILL.md" "HTTP $STATUS or missing frontmatter"
  fi
done

echo ""
echo "═══════════════════════════════════════════════"
echo "  SECTION 10: Error Handling"
echo "═══════════════════════════════════════════════"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/bot/skills/nonexistent-vendor-xyz")
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
check_status "Nonexistent vendor returns 404" "404" "$STATUS" "$BODY"
check_contains "404 response has error field" "$BODY" '"error"'
check_contains "404 response has vendor_not_found error code" "$BODY" '"vendor_not_found"'
check_contains "404 response has message field" "$BODY" '"message"'

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -L "$BASE_URL/api/v1/bot/skills/")
if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "308" ]; then
  pass "Trailing slash on list endpoint returns 200 or 308 redirect (got $RESPONSE)"
else
  fail "Trailing slash on list endpoint" "expected 200 or 308, got $RESPONSE"
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "  SECTION 11: Frontend Pages"
echo "═══════════════════════════════════════════════"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/skills")
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
check_status "GET /skills catalog page returns 200" "200" "$STATUS" "$BODY"
check_contains "/skills page contains Vendor Skills heading" "$BODY" "Vendor Skills"

RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/skills/amazon")
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
check_status "GET /skills/amazon detail page returns 200" "200" "$STATUS" "$BODY"
check_contains "/skills/amazon page contains Amazon" "$BODY" "Amazon"

RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/skills/staples")
BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)
check_status "GET /skills/staples detail page returns 200" "200" "$STATUS" "$BODY"
check_contains "/skills/staples page contains Staples" "$BODY" "Staples"

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
