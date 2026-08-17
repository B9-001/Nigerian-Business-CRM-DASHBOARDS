# Billing — SaaS subscriptions (Paystack)

This document covers **BusinessOS's own revenue**: organizations paying to subscribe to the platform. It has nothing to do with any payments an organization might process from its own customers — that's a separate concept this codebase doesn't model at all, and the two must never be conflated.

All subscription revenue settles to the platform owner's Paystack account, split **100%** to a subaccount (`PAYSTACK_SUBACCOUNT_CODE`) — the subaccount was created with `percentage_charge: 0`, meaning the main account retains 0% and the subaccount receives the full amount.

## 1. Architecture

```
app/(dashboard)/settings/billing/    Organization-facing billing UI
app/(dashboard)/admin/               Platform-admin billing dashboard (MRR/ARR, orgs,
                                      subscriptions, transactions, plans, refunds, webhooks)
app/api/billing/                     checkout, verify (checkout callback), cancel, downgrade
app/api/webhooks/paystack/           Inbound Paystack webhook (signature-verified, idempotent)
lib/billing/
  provider.ts                       Provider-agnostic interface (BillingProvider)
  paystack.ts                       Paystack implementation (checkout/verify/refund)
  paystack-signature.ts             Webhook HMAC-SHA512 verification (kept import-clean of
                                     `server-only` so it's unit-testable directly)
  process-payment.ts                Shared verify-and-activate logic used by BOTH the
                                     checkout callback AND the webhook — whichever fires
                                     first wins, the other is a safe no-op
  subscription.ts                   Activate / cancel / schedule downgrade / renewal maintenance
  entitlements.ts                   canAccessFeature(), getFeatureLimit() — request-cached
  usage.ts                          Metered usage tracking (AI requests, etc.), server-only
  invoices.ts                       Invoice record creation (no PDF generation — see below)
```

Adding another provider (Stripe, Flutterwave) later means writing a new file that implements `BillingProvider` from `provider.ts` — no call site outside `lib/billing/` should ever import `paystack.ts` directly.

## 2. Database schema

See `supabase/migrations/20260101001400_billing_paystack.sql` (and the follow-up `20260101001500_fix_public_grants.sql`, `20260101001600_audit_logs_nullable_org.sql`).

| Table | Purpose |
|---|---|
| `plans` | Extended with `slug`, `description`, `currency`, `annual_price_ngn`, `is_active`, `is_public` |
| `plan_features` | Feature-flag entitlements per plan (`crm`, `ai_assistant`, `zoom`, ...) |
| `subscriptions` | One row per organization — its current lifecycle subscription record |
| `billing_customers` | Maps an org to its Paystack customer code |
| `billing_transactions` | Every checkout attempt (`PENDING` → `SUCCESS`/`FAILED`/`ABANDONED`) |
| `invoices` | One per successful transaction |
| `billing_events` | Webhook idempotency ledger — service-role only, no client policies |
| `usage_records` | Metered feature usage per calendar-month period |
| `refunds` | Platform-admin-only mutation surface |

Every org-scoped table is RLS-protected: `organization_id = current_org_id() AND has_permission('billing.manage')` for reads; all writes go through verified server routes using the service-role client. `billing_events` and `plans` writes are service-role/platform-admin only — no ordinary organization user, however privileged within their org, can touch them.

**Pricing** (set per the platform owner's explicit instruction, overriding an earlier draft prompt that suggested different numbers):
- Starter: ₦25,000/month
- Business: ₦100,000/month
- Enterprise: ₦150,000/month

Every organization gets a **14-day trial on Starter** the moment it's created (`create_organization_and_join` RPC seeds it atomically alongside the org itself).

## 3. Checkout flow

1. Org clicks "Upgrade" → client POSTs `{ planId }` to `/api/billing/checkout` (never an amount — the server always loads the price from `plans`, per CLAUDE.md's "never trust client-supplied amounts" rule).
2. Server creates a `billing_transactions` row (`PENDING`) and calls Paystack's `/transaction/initialize` with the subaccount attached, returns `authorization_url`.
3. Browser is redirected to Paystack's hosted checkout.
4. Paystack redirects back to `/api/billing/verify?reference=...` (the `callback_url`).
5. That route — and, independently, the `/api/webhooks/paystack` handler on `charge.success` — both call the SAME `processVerifiedTransaction()` function, which re-verifies the transaction via Paystack's `/transaction/verify` endpoint (never trusts the redirect alone) and is idempotent (checks the transaction's stored status before doing anything, and re-checks immediately before writing to guard the redirect/webhook race).
6. On success: `subscriptions` is activated/renewed, `organizations.plan` updated, an `invoices` row created.

## 4. Downgrades vs upgrades vs cancellation

- **Upgrades** go through checkout (payment required) → `activateSubscription()` applies immediately.
- **Downgrades** don't require payment — `POST /api/billing/downgrade` calls `scheduleDowngrade()`, which sets `pending_plan_id`/`pending_plan_effective_at` to the current period end. The org keeps what it paid for until then. `runSubscriptionMaintenance()` (in `lib/billing/subscription.ts`) applies due downgrades, expires trials, and finalizes scheduled cancellations — **not wired to a scheduler in this environment** (no cron/worker is currently invoking it; see "Known limitations").
- **Cancellation** (`POST /api/billing/cancel`) defaults to `cancel_at_period_end: true` (access continues until the period ends); `{ immediate: true }` cancels right away. Cancelling **never deletes any organization data** — only the subscription's status changes.

## 5. Environment variables

```
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_...   # safe to expose to the browser by design
PAYSTACK_SECRET_KEY=sk_test_...               # server-only, never sent to the client
PAYSTACK_SUBACCOUNT_CODE=ACCT_...             # where subscription revenue settles
```

Currently configured with **test-mode** keys. Swap for `pk_live_`/`sk_live_` when ready to accept real payments — nothing else in the code needs to change.

## 6. Webhook configuration

Register in the Paystack dashboard (Settings → API Keys & Webhooks):

```
Development: (use a tunnel, e.g. ngrok) https://<tunnel>.ngrok.io/api/webhooks/paystack
Production:  https://<your-domain>/api/webhooks/paystack
```

The handler verifies `x-paystack-signature` (HMAC-SHA512 of the raw body using the secret key) before doing anything else, persists every event to `billing_events` keyed on a deterministic `idempotency_key` (`${event_type}:${reference}`), and always returns HTTP 200 even on internal processing errors (the error is recorded on the event row for the platform admin's Webhook Events viewer instead of triggering Paystack's retry storm for an error redelivery won't fix, e.g. a since-deleted plan).

## 7. Testing Paystack in test mode

- Use Paystack's [test cards](https://paystack.com/docs/payments/test-payments/) — e.g. `4084084084084081` with any future expiry/CVV for a successful charge.
- To test a failed payment, use a test card documented as declining.
- To test the webhook locally without a live checkout, POST a signed payload to `/api/webhooks/paystack` yourself: sign `JSON.stringify({event, data})` with `HMAC-SHA512(PAYSTACK_SECRET_KEY, body)` and set it as `x-paystack-signature`.
- `__tests__/billing/webhook-idempotency.test.ts` verifies the `billing_events` unique constraint directly. `__tests__/tenant-isolation/billing.test.ts` verifies Organization A can never read Organization B's subscription/transactions.

## 8. Entitlements & usage

- `canAccessFeature('zoom')` — checks the org's current plan's `plan_features` row (request-cached, backed by the `can_access_feature` SQL function).
- `getFeatureLimit('max_users')` — reads the numeric limit off `plans` for the org's current plan.
- `checkUsageLimit(orgId, 'ai_requests', 'max_ai_requests_month')` — compares current-month `usage_records` against the plan limit.

**Not yet wired everywhere** — the primitives are real and tested, but only demonstrated at a couple of call sites (not swept across every feature in the app). Extending enforcement to more actions (e.g. blocking task/project creation past a limit) is straightforward: call `canAccessFeature()`/`checkUsageLimit()` before the mutation, same pattern as the existing permission checks.

## 9. Known limitations (be honest about these)

- **Not a true Paystack recurring subscription integration.** Each successful checkout extends `current_period_end` by one billing interval from the payment time — there's no Paystack `Plan`/`Subscription` object doing automatic recurring charges. A real production deployment would want to either wire up Paystack's native subscription API (recurring authorization charges) or run a scheduled job that emails/notifies organizations before their period ends so they can manually renew.
- **`runSubscriptionMaintenance()` isn't scheduled.** The function exists and is correct, but nothing currently invokes it periodically — wire it into `workers/analytics` (or a dedicated cron) before relying on scheduled downgrades/trial expiry/cancel-at-period-end actually taking effect automatically.
- **No PDF invoice generation.** `invoices.pdf_url` stays null; the "Download PDF" button in the UI uses the browser's native print-to-PDF (`window.print()`) against an on-screen invoice view instead of a server-rendered PDF file.
- **MRR/ARR/churn on the platform-admin dashboard are simple current-snapshot calculations**, not cohort-based historical analytics — there are no historical snapshots to compute true month-over-month churn, so the churn figure is explicitly labeled "approximate."
- **Google/refund email notifications aren't sent** — no email provider is configured in this environment (see root `.env.example`'s `RESEND_API_KEY`/`SMTP_URL`); the in-app notification primitives exist (`lib/notifications/`) but billing-specific notification helpers (trial ending, payment failed, etc.) haven't been added yet.
- Paystack keys currently in use are **test mode** — verified against real live API calls during development (bank resolution, subaccount creation), but no real end-to-end checkout has been completed since that requires a browser session to walk through Paystack's hosted payment page.
