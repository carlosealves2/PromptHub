#!/bin/bash
# E2E Authentication Flow Verification Script
#
# This script verifies the complete authentication flow for the RBAC system.
# Run this script after starting PostgreSQL and the API server.
#
# Prerequisites:
#   1. docker compose up -d postgres
#   2. npx nx serve api (in another terminal)
#
# Usage: ./scripts/e2e-auth-verification.sh

set -e

API_BASE_URL="${API_BASE_URL:-http://localhost:3000/api}"
TEST_EMAIL="test.user.$(date +%s)@example.com"
TEST_PASSWORD="TestPassword123!"
TEST_NAME="Test User"

echo "=============================================="
echo "E2E Authentication Flow Verification"
echo "=============================================="
echo ""
echo "API Base URL: $API_BASE_URL"
echo "Test Email: $TEST_EMAIL"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

success() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
}

failure() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    exit 1
}

info() {
    echo -e "${YELLOW}→${NC} $1"
}

# Test 1: Register new user
echo "----------------------------------------------"
echo "Test 1: POST /api/auth/register - Create test user"
echo "----------------------------------------------"
info "Registering user: $TEST_EMAIL"

REGISTER_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$TEST_EMAIL\", \"password\": \"$TEST_PASSWORD\", \"name\": \"$TEST_NAME\"}")

REGISTER_BODY=$(echo "$REGISTER_RESPONSE" | sed '$d')
REGISTER_STATUS=$(echo "$REGISTER_RESPONSE" | tail -n1)

echo "Response Status: $REGISTER_STATUS"
echo "Response Body: $REGISTER_BODY"
echo ""

if [ "$REGISTER_STATUS" -eq 201 ]; then
    success "User registration successful (HTTP 201)"
    ACCESS_TOKEN=$(echo "$REGISTER_BODY" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
    REFRESH_TOKEN=$(echo "$REGISTER_BODY" | grep -o '"refreshToken":"[^"]*"' | cut -d'"' -f4)

    if [ -z "$ACCESS_TOKEN" ]; then
        failure "Access token not found in response"
    fi
    success "Access token received"
else
    failure "Expected HTTP 201, got $REGISTER_STATUS"
fi
echo ""

# Test 2: Login with credentials
echo "----------------------------------------------"
echo "Test 2: POST /api/auth/login - Authenticate user"
echo "----------------------------------------------"
info "Logging in as: $TEST_EMAIL"

LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$TEST_EMAIL\", \"password\": \"$TEST_PASSWORD\"}")

LOGIN_BODY=$(echo "$LOGIN_RESPONSE" | sed '$d')
LOGIN_STATUS=$(echo "$LOGIN_RESPONSE" | tail -n1)

echo "Response Status: $LOGIN_STATUS"
echo "Response Body: $LOGIN_BODY"
echo ""

if [ "$LOGIN_STATUS" -eq 200 ]; then
    success "User login successful (HTTP 200)"
    ACCESS_TOKEN=$(echo "$LOGIN_BODY" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

    if [ -z "$ACCESS_TOKEN" ]; then
        failure "Access token not found in login response"
    fi
    success "Access token received from login"
else
    failure "Expected HTTP 200, got $LOGIN_STATUS"
fi
echo ""

# Test 3: Access profile WITH valid token
echo "----------------------------------------------"
echo "Test 3: GET /api/auth/profile WITH Bearer token"
echo "----------------------------------------------"
info "Accessing profile with Bearer token"

PROFILE_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE_URL/auth/profile" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

PROFILE_BODY=$(echo "$PROFILE_RESPONSE" | sed '$d')
PROFILE_STATUS=$(echo "$PROFILE_RESPONSE" | tail -n1)

echo "Response Status: $PROFILE_STATUS"
echo "Response Body: $PROFILE_BODY"
echo ""

if [ "$PROFILE_STATUS" -eq 200 ]; then
    success "Profile access with token successful (HTTP 200)"

    # Verify response contains expected fields
    if echo "$PROFILE_BODY" | grep -q "$TEST_EMAIL"; then
        success "Response contains correct user email"
    else
        failure "Response does not contain expected email"
    fi
else
    failure "Expected HTTP 200, got $PROFILE_STATUS"
fi
echo ""

# Test 4: Access profile WITHOUT token
echo "----------------------------------------------"
echo "Test 4: GET /api/auth/profile WITHOUT token"
echo "----------------------------------------------"
info "Attempting to access profile without authentication"

UNAUTH_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE_URL/auth/profile")

UNAUTH_BODY=$(echo "$UNAUTH_RESPONSE" | sed '$d')
UNAUTH_STATUS=$(echo "$UNAUTH_RESPONSE" | tail -n1)

echo "Response Status: $UNAUTH_STATUS"
echo "Response Body: $UNAUTH_BODY"
echo ""

if [ "$UNAUTH_STATUS" -eq 401 ]; then
    success "Unauthorized access correctly rejected (HTTP 401)"
else
    failure "Expected HTTP 401, got $UNAUTH_STATUS"
fi
echo ""

# Test 5: Duplicate registration (should fail with 409)
echo "----------------------------------------------"
echo "Test 5: POST /api/auth/register - Duplicate email"
echo "----------------------------------------------"
info "Attempting to register same email again"

DUPLICATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$TEST_EMAIL\", \"password\": \"$TEST_PASSWORD\", \"name\": \"$TEST_NAME\"}")

DUPLICATE_BODY=$(echo "$DUPLICATE_RESPONSE" | sed '$d')
DUPLICATE_STATUS=$(echo "$DUPLICATE_RESPONSE" | tail -n1)

echo "Response Status: $DUPLICATE_STATUS"
echo "Response Body: $DUPLICATE_BODY"
echo ""

if [ "$DUPLICATE_STATUS" -eq 409 ]; then
    success "Duplicate registration correctly rejected (HTTP 409)"
else
    failure "Expected HTTP 409 for duplicate email, got $DUPLICATE_STATUS"
fi
echo ""

# Test 6: Invalid login credentials
echo "----------------------------------------------"
echo "Test 6: POST /api/auth/login - Invalid password"
echo "----------------------------------------------"
info "Attempting login with wrong password"

INVALID_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$TEST_EMAIL\", \"password\": \"WrongPassword123!\"}")

INVALID_BODY=$(echo "$INVALID_RESPONSE" | sed '$d')
INVALID_STATUS=$(echo "$INVALID_RESPONSE" | tail -n1)

echo "Response Status: $INVALID_STATUS"
echo "Response Body: $INVALID_BODY"
echo ""

if [ "$INVALID_STATUS" -eq 401 ]; then
    success "Invalid credentials correctly rejected (HTTP 401)"
else
    failure "Expected HTTP 401 for invalid credentials, got $INVALID_STATUS"
fi
echo ""

# Summary
echo "=============================================="
echo "E2E VERIFICATION SUMMARY"
echo "=============================================="
echo ""
echo -e "${GREEN}All tests passed successfully!${NC}"
echo ""
echo "Verified endpoints:"
echo "  ✓ POST /api/auth/register - User registration"
echo "  ✓ POST /api/auth/login - User authentication"
echo "  ✓ GET /api/auth/profile - Protected route with token (200)"
echo "  ✓ GET /api/auth/profile - Protected route without token (401)"
echo "  ✓ POST /api/auth/register - Duplicate email handling (409)"
echo "  ✓ POST /api/auth/login - Invalid credentials handling (401)"
echo ""
echo "=============================================="
