-- CreditClaw Production Schema Sync Script
-- Run this on the Neon production database BEFORE your next deploy
-- This reconciles naming mismatches so drizzle-kit push runs cleanly
-- Safe to run multiple times (idempotent)

BEGIN;

-- ═══════════════════════════════════════════════════════════════════
-- 1. Rename unique constraints from PostgreSQL _key to Drizzle _unique
--    (skips any that were already renamed)
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT unnest(ARRAY[
      ARRAY['base_pay_payments',        'base_pay_payments_tx_id_key',                   'base_pay_payments_tx_id_unique'],
      ARRAY['checkout_confirmations',   'checkout_confirmations_confirmation_id_key',     'checkout_confirmations_confirmation_id_unique'],
      ARRAY['checkout_pages',           'checkout_pages_checkout_page_id_key',            'checkout_pages_checkout_page_id_unique'],
      ARRAY['invoices',                 'invoices_invoice_id_key',                        'invoices_invoice_id_unique'],
      ARRAY['invoices',                 'invoices_reference_number_key',                  'invoices_reference_number_unique'],
      ARRAY['master_guardrails',        'master_guardrails_owner_uid_key',                'master_guardrails_owner_uid_unique'],
      ARRAY['notification_preferences', 'notification_preferences_owner_uid_key',         'notification_preferences_owner_uid_unique'],
      ARRAY['owners',                   'owners_uid_key',                                 'owners_uid_unique'],
      ARRAY['pairing_codes',            'pairing_codes_code_key',                         'pairing_codes_code_unique'],
      ARRAY['payment_links',            'payment_links_payment_link_id_key',              'payment_links_payment_link_id_unique'],
      ARRAY['qr_payments',             'qr_payments_payment_id_key',                     'qr_payments_payment_id_unique'],
      ARRAY['rail5_cards',             'rail5_cards_card_id_key',                         'rail5_cards_card_id_unique'],
      ARRAY['rail5_checkouts',         'rail5_checkouts_checkout_id_key',                 'rail5_checkouts_checkout_id_unique'],
      ARRAY['sales',                   'sales_sale_id_key',                               'sales_sale_id_unique'],
      ARRAY['seller_profiles',         'seller_profiles_owner_uid_key',                   'seller_profiles_owner_uid_unique'],
      ARRAY['seller_profiles',         'seller_profiles_slug_key',                        'seller_profiles_slug_unique'],
      ARRAY['vendors',                 'vendors_slug_key',                                'vendors_slug_unique'],
      ARRAY['waitlist_entries',        'waitlist_entries_email_key',                       'waitlist_entries_email_unique'],
      ARRAY['obfuscation_state',       'obfuscation_state_bot_id_key',                   'obfuscation_state_bot_id_unique'],
      ARRAY['rail4_cards',            'rail4_cards_bot_id_key',                           'rail4_cards_bot_id_unique'],
      ARRAY['spending_permissions',    'spending_permissions_bot_id_key',                 'spending_permissions_bot_id_unique']
    ]) AS arr
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = r.arr[2]
      AND connamespace = 'public'::regnamespace
    ) THEN
      EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I', r.arr[1], r.arr[2], r.arr[3]);
      RAISE NOTICE 'Renamed % → %', r.arr[2], r.arr[3];
    ELSE
      RAISE NOTICE 'Skipped % (not found or already renamed)', r.arr[2];
    END IF;
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 2. Drop duplicate index on obfuscation_events
-- ═══════════════════════════════════════════════════════════════════

DROP INDEX IF EXISTS "obfuscation_events_bot_idx";

-- ═══════════════════════════════════════════════════════════════════
-- 3. Drop legacy columns from checkout_pages
--    (Data verified: already exists in seller_profiles table)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE "checkout_pages" DROP COLUMN IF EXISTS "seller_name";
ALTER TABLE "checkout_pages" DROP COLUMN IF EXISTS "seller_logo_url";
ALTER TABLE "checkout_pages" DROP COLUMN IF EXISTS "seller_email";

COMMIT;
