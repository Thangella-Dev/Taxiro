Subject: Taxiro Development Update - 22 July 2026

Hi Sir,

This update covers planned/completed work for 22 July 2026.

Today I completed a production-focused Taxiro slice covering vehicle-aware nearby rider visibility and the payment/wallet/driver-settlement foundation.

Completed:

- Added vehicle-aware nearby rider preview for users.
- Customer maps now request nearby verified riders based on the selected booking vehicle type.
- Customer maps continue showing pickup-area nearby riders before assignment instead of hiding them during scheduled/ready states.
- Added payment/wallet/settlement foundation with `payments`, `payment_events`, and `driver_settlement_items` tables.
- Expanded supported payment states for cash, UPI, direct-driver UPI, wallet, cards, net banking, corporate, pay-later, and partial wallet/online payments.
- Added backend payment order creation through `create_ride_payment_order`.
- Updated ride completion so rider payment confirmation creates payment records, payment events, driver settlement items, and wallet earning ledger entries where applicable.
- Added customer wallet debit validation for wallet payments.
- Added Taxiro Wallet as a booking payment preference.
- Applied the new migrations to live Supabase and smoke-tested the new payment table and vehicle-aware nearby rider RPC.

Verification completed:

- `npm run db:validate` passed with 32 additive migrations.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run test` passed with 11 unit tests.
- `npm run build` passed with 24 app routes.

Deployment note:

The latest two migrations have already been applied to the live Supabase project:

- `20260721143000_vehicle_aware_nearby_rider_preview.sql`
- `20260721150000_payment_wallet_settlement_foundation.sql`

Next planned work:

- Add customer wallet balance/top-up UI after payment provider selection.
- Build admin payment reconciliation and payout-batch screens.
- Run two-device QA for vehicle-specific nearby rider visibility.

Regards,

Thangella G