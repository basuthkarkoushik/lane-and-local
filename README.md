# Lane & Local — Neighbourhood Delivery Desk

A React + Vite and Express application for neighbourhood restaurant ordering and delivery decisions. It combines customer checkout, owner/dispatcher operations, order profitability and rider-capacity checks in one JSON-backed prototype.

## Run locally

Use a current Node.js LTS release and npm.

**Terminal 1 — API**

```bash
cd server
npm install
npm start
```

The Express API runs at `http://localhost:5000`.

**Terminal 2 — frontend**

```bash
cd client
npm install
npm run dev
```

Open the URL shown by Vite (normally `http://localhost:5173`). Vite proxies `/api` requests to Express on port 5000.

**Run backend tests**

```bash
cd server
npm test
```

## Main routes

- `/` — shared public Lane & Local landing page, with workspace sign-in and a direct Browse Food link. Signed-in roles are routed to their own default home.
- `/login` — customer/owner registration and sign-in.
- `/my-orders` — customer's own orders.
- `/my-orders/new` — browse restaurants, select menu items, checkout and place an order.
- `/my-orders/:id` — order summary and animated status tracker.
- `/premium` — demo Lane & Local Plus membership.
- `/overview` — default landing page for owners and dispatchers. Both roles get the visual operations hero with a horizontal KPI rail, early-alert metrics, performance charts, recent orders, and the full early-warning controls embedded in the same page.
- `/orders` — order queue and status management, including CSV export where permitted.
- `/orders/new` — combined **Quote & Simulator** workspace with tabs for creating a delivery quote and running a what-if simulation. The legacy `/simulator` route opens the simulator tab directly.
- `/menu` — owner menu management: add, edit, temporarily pause/resume, or remove items. Paused items are hidden from the customer menu and rejected at checkout.
- `/team` — owner-managed dispatcher accounts.
- `/rider-registration` — owners create or deactivate rider logins and link them to their restaurant-scoped rider capacity profiles. `/riders` is the dispatcher fleet/capacity view; only riders with active accounts are eligible for assignment. `/rider/orders` is the rider-only inbox for assigned deliveries and accept/reject responses.
- `/settings` — service radius comparison and what-if simulator in one place.
- `/history` — order history and CSV download for owners; decision history for dispatchers.
- `/analytics` — on-time delivery rate, contribution after recorded refunds, and flagged-order percentage.
- `/alerts` — redirects staff to the Early-Warning Alert Centre embedded in `/overview`; there is no separate Alerts navigation option for either staff role.

## Dispatcher workspace

Dispatcher navigation is presented in a centred top bar. **Overview** opens by default. **Quote & Simulator** combines delivery-quote creation and the what-if simulator in a single workspace; the Overview page also embeds the early-warning alert filters, refresh, CSV export, acknowledge and resolve actions. The visual treatment follows Lane & Local's forest-green, sage, ivory and coral design system, with a custom route-and-leaf brand mark. The quote preview includes a rider-cost sensitivity slider; it calculates scenario contribution separately and does not alter the saved quote.

## Demo owner accounts

These local-development accounts are seeded automatically. Each is associated with its own sample restaurant:

| Email | Password |
|---|---|
| `owner.greentable@lane.local` | `LaneDemo123!` |
| `owner.tiffin@lane.local` | `LaneDemo123!` |
| `owner.basil@lane.local` | `LaneDemo123!` |
| `owner.mango@lane.local` | `LaneDemo123!` |

You can also register a customer or a new restaurant owner at `/login`. A new owner receives a separate restaurant record and sample menu. The owner can open **Team & Access** to create/deactivate dispatcher accounts and **Rider Registration** to create rider logins or link existing rider capacity profiles for their own restaurant. Dispatchers and riders sign in with the account the owner creates; they cannot register themselves publicly.

Passwords are stored as scrypt hashes, and the database stores session-token hashes rather than raw tokens. Owner menus are scoped to the owner's restaurant. This is still a prototype, not production-grade identity infrastructure. Do not expose the demo accounts publicly.


## Rider account and delivery workflow

1. The owner opens **Rider Registration**, creates a rider login, and either links an existing capacity profile or creates a new one.
2. The dispatcher assigns an eligible order to a rider who has an active login. Riders without an active account are not assignable.
3. The rider signs in and opens **My deliveries** to review assigned orders, customer name and phone, saved delivery address, item quantities where available, promised delivery time, distance and payment/total details.
4. The rider can **Accept delivery** or **Reject assignment**. Rejection requires a reason and returns the order to Pending for dispatcher reassignment; the capacity slot is released. Acceptance is recorded and visible to staff.
5. A rider account can only access its own assigned-delivery API, not the staff-wide order, alert or rider lists.

## Customer order flow

1. Open `/` and choose **Browse food**, or go directly to `/my-orders/new`.
2. Select menu items and quantities; the cart is saved locally while browsing.
3. Enter delivery details, review the itemised total, and select demo online payment or cash on delivery.
4. Checkout requires a signed-in customer account. If necessary, the cart and checkout form are retained while the customer signs in.
5. After successful submission, the customer is sent to `/my-orders?placed=<order-id>`. Their order appears in My Orders and can be tracked.

The backend validates restaurant/menu IDs and quantities and calculates the basket total from server-side prices. Customers can only view/cancel their own orders. Owner and dispatcher API results are scoped to their restaurant.

## Payment and membership limits

- `demo_upi` simulates a successful payment confirmation; it does not collect real money or connect to a payment provider.
- Cash on delivery is recorded as payable on delivery.
- Lane & Local Plus is a demo membership status priced illustratively at ₹99/month. Subscription activation does not charge or renew a real subscription.
- The order tracker polls backend status; it is not GPS tracking or live route navigation.

## Business rules tested

- The standard sample order contributes ₹22.
- Increasing rider cost to ₹85 produces −₹8 and an unprofitable flag.
- Orders cannot overbook rider capacity; when no eligible slot exists, the workflow proposes a later slot.
- Input validation, legal status transitions, customer ownership, tenant isolation, cancellation rules and audit records are covered by the backend tests.

## Storage and production limitations

The server stores operational data in `server/data/db.json`, seeded/migrated from `Starter_Data/C26/fixture.json`. JSON storage is suitable for a local prototype, but it is not a substitute for database transactions under multiple concurrent production writes. Authentication, rate limiting, real payment processing, subscription billing, live GPS and production deployment hardening would need further work before real-world use. Menu management is implemented for the prototype, with restaurant-scoped owner access and availability enforcement at checkout.
