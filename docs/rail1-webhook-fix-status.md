# Rail 1: Stripe Onramp Webhook Fix

**Date:** February 25, 2026

## Issue

After funding a Rail 1 (Privy) wallet via Stripe Crypto Onramp, the wallet balance remained at $0.00. The dashboard never reflected the deposit.

## Root Causes Found

1. **No Stripe webhook endpoint was registered.** The Stripe dashboard had no webhook destination configured for `crypto.onramp_session.updated`, so Stripe never sent fulfillment events to the server.

2. **`STRIPE_WEBHOOK_SECRET` was not set** in production environment variables.

3. **Event type mismatch.** The webhook handler compared against `crypto.onramp_session_updated` (underscore), but Stripe sends `crypto.onramp_session.updated` (dot). Even after fixes #1 and #2, the handler silently ignored every event.

## Fixes Applied

1. Created a Stripe webhook destination pointing to `https://creditclaw.com/api/v1/stripe-wallet/webhooks/stripe`, listening for `crypto.onramp_session.updated`.

2. Added `STRIPE_WEBHOOK_SECRET_ONRAMP` environment secret and updated the handler to reference it (supports multiple webhook secrets for different Rails).

3. Fixed event type string from `crypto.onramp_session_updated` to `crypto.onramp_session.updated`.

4. Added detailed `[Onramp Webhook]` logging throughout the handler for observability.

## Status

**Deployed. Awaiting confirmation** that a real onramp funding now correctly credits the wallet balance and creates a deposit transaction.

### To verify:

1. Fund a wallet via Stripe Crypto Onramp on production
2. Check production logs for `[Onramp Webhook] Balance updated and transaction created successfully`
3. Confirm the dashboard shows the updated balance after refresh
