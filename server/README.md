# Lane & Local — Neighbourhood Delivery Desk

**Fynd × NMIMS Hyderabad | C26 Product & Business Simulation**

A working delivery-management app for small neighbourhood restaurants. It answers four questions for every order:

1. Is it profitable?
2. Is a rider available?
3. Can the promised delivery time be met?
4. What should we do if the order is risky or loses money?

The app uses the supplied C26 `fixture.json` as its starting data, and everything shown (dashboard, analytics, alerts) is calculated from saved data. There are no hardcoded numbers and no random values in business decisions.

---

## 1. Who uses it (three roles)

| | Business Owner | Dispatcher | Customer |
|---|---|---|---|
| Purpose | Commercial decisions | Day-to-day decisions | Orders and tracking |
| Overview, Orders, New Quote, Feasibility | Yes | Yes | No |
| Accept / reject / reschedule / assign / status / cancel | Yes | Yes | No |
| Alert Centre (acknowledge, resolve) | Yes | Yes | No |
| Decision History and CSV exports | Yes | Yes | No |
| What-If Simulator | Explore and apply | Explore only | No |
| Rider fleet (add riders, change capacity) | Yes | No (can still assign) | No |
| Service Radius, Analytics, Settings | Yes | No | No |
| Place, track and cancel own orders | No | No | Yes |

The customer sees menu items, basket and delivery totals, payment status, promised/estimated time and plain-language status updates. Internal costs, margins and detailed feasibility outputs are never sent to the customer. Every logged decision records which role made it.

**Sign-in and restaurant tenancy.** Customers and restaurant owners register with email/password; the server stores scrypt password hashes and bearer-session token hashes. Dispatchers are created by an owner and inherit that owner's restaurant scope. Customer order ownership is keyed by customer account, not only by display name. This JSON-backed auth is suitable for the demo, not a production identity system.

---

### Demo sign-in accounts

Seeded owner accounts (local demo only) are:

- `owner.greentable@lane.local` / `LaneDemo123!`
- `owner.tiffin@lane.local` / `LaneDemo123!`
- `owner.basil@lane.local` / `LaneDemo123!`
- `owner.mango@lane.local` / `LaneDemo123!`

Register new customers or restaurant owners at `/login`. Owners can add/deactivate dispatchers from **Team & Access**. Each owner and dispatcher sees only that restaurant's operational data. Do not expose seeded demo credentials beyond a local development environment.

## 2. Tech stack

- Frontend: React + Vite, React Router, Recharts, lucide-react (plain CSS, Fynd-inspired theme)
- Backend: Node.js + Express (REST APIs)
- Storage: JSON file at `server/data/db.json`, seeded from `Starter_Data/C26/fixture.json`

The Lane & Local brand uses an editorial serif/sans-serif pairing and warm ivory, forest green, sage and coral accents.

---

## 3. Install and run

You need **Node.js LTS** (check with `node -v` and `npm -v`).

```bash
# 1. install the backend
cd server
npm install

# 2. install the frontend (new terminal, from the project folder)
cd client
npm install
```

Start both, each in its own terminal:

```bash
# Terminal 1: backend, http://localhost:5000
cd server
npm start

# Terminal 2: frontend, http://localhost:5173
cd client
npm run dev
```

Open **http://localhost:5173**. The frontend forwards `/api` calls to the backend on port 5000, so both must be running.

### Run the tests

```bash
cd server
npm test
```

The test runner prints `PASS` lines for the business-rule suites, customer-commerce scenarios, authentication, multi-restaurant isolation, dispatcher invitations, and customer order-to-My-Orders flow.

### Start fresh

Sign in to the relevant owner account → **Settings → Reset demo data** to reset that restaurant's operational records. Other restaurants, customer accounts and dispatcher accounts are not wiped by a tenant reset.

---

## 4. Features

**Core**
- Create and edit delivery quotes, with backend and frontend validation.
- Contribution calculator, with the loss clearly flagged and explained.
- Accept, reject or reschedule with a required reason. Assign riders manually or by recommendation.
- Order lifecycle: Pending → Assigned → Preparing → Out for Delivery → Delivered, plus Cancelled. Invalid transitions are blocked.
- Restaurant preparation delay reporting with revised estimates.
- Delivery progress timeline (simulated status updates, not live GPS).
- Overview dashboard, Analytics (charts), searchable Decision History, CSV exports (orders, alerts, history).


### Customer ordering extension (Lane & Local)

- `GET /api/customer/restaurants` returns four illustrative neighbourhood restaurants and their menus. Menu prices are sample data maintained on the server.
- Customer checkout validates restaurant/item IDs and quantity on the server, calculates the basket subtotal from server-side menu prices, records address and phone, and stores individual order lines.
- The checkout summary shows item subtotal, ₹30 delivery fee and total. This prototype does not add a separate tax line.
- Payment choices are **Demo online payment** (explicit simulation, no processor or real charge) and **Cash on delivery**. No card credentials are collected. A live launch requires a real payment provider, server-side verification/webhooks and reconciliation.
- `GET /api/customer/premium`, `POST /api/customer/premium/subscribe` and `POST /api/customer/premium/cancel` manage the demo `Lane & Local Plus` subscription in `db.json`. The illustrative plan is ₹99/month, but activation/cancellation are simulated and no money is charged.
- Standard customers can cancel while the order is `Pending`. Active Plus members can also cancel while `Assigned`. Online cancellation is blocked once the status becomes `Preparing` or later. Staff can still perform operational cancellation through the staff workflow with a recorded reason.
- Customer order tracking displays an animated stage timeline and polls order status every 8 seconds. This is status animation, **not live GPS tracking**.
- The dispatcher order detail now shows restaurant, menu lines, delivery/contact details and payment status for orders from the customer portal.

**Four extra features**
1. **Smart Delivery Feasibility** is a Green, Amber or Red result from transparent rules, with reasons and a next action.
2. **What-If Profit Simulator** uses sliders and numeric inputs, shows original vs simulated contribution, resets to baseline, and only saves after confirmation with a reason.
3. **Early-Warning Alert Centre** covers 7 alert types with 3 severities, with filters, acknowledge, resolve, no duplicates, auto-resolve when fixed, and full traceability.
4. **Dynamic Service Radius** compares radii side by side (current vs proposed), explains the trade-off, and records the original value, proposed value, reason and decision.

---

## 5. Business rules (all visible, none hidden)

**Contribution** = Merchant Fee + Customer Delivery Fee − Rider Cost − Support Cost − Payment Cost.
Merchant fee = basket value × merchant fee %.
Example: ₹400 × 15% = ₹60, + ₹30 − ₹55 − ₹8 − ₹5 = **₹22**. With rider cost ₹85, it becomes **−₹8**.
Contribution is not final net profit.

**Feasibility** (profit, radius, time and rider capacity are each checked separately)

| Result | When |
|---|---|
| Red | Negative contribution, invalid input, outside the service radius, or estimated time later than the promise |
| Amber | No rider has free capacity (a later slot is proposed), or margin is below the thin-margin threshold (₹5) |
| Green | Positive contribution, inside the radius, can meet the promise, and a rider is free |

A profitable order is never Green if no rider is free.

**Estimated delivery time** = preparation (10 min) + handover (5 min) + distance ÷ speed (20 km/h) + any reported delay. This is a simple, disclosed model. It is not live routing or GPS. The values can be changed in Settings.

**Rider recommendation:** only riders with free capacity are considered. The rider with the most free slots comes first, then the lowest ID. Overbooking is blocked. Cancelling or delivering an order frees the slot.

**Later slot:** when every rider is full, a pending order can be rescheduled by +30 minutes (configurable).

---

## 6. Mandatory test scenarios

All run with `npm test` in the `server` folder.

| # | Scenario | Test |
|---|---|---|
| 1 | ₹400 basket gives ₹22 | `contribution.test.js` PASS 1 |
| 2 | Rider cost ₹85 gives −₹8 and a loss alert | `contribution.test.js` PASS 2, `extras.test.js` PASS 2 |
| 3 | All riders full gives zero capacity and a later slot | `orders.test.js` PASS 7, `feasibility.test.js` PASS 2 |
| 4 | Order outside the radius is flagged | `feasibility.test.js` PASS 3, `extras.test.js` PASS 8 |
| 5 | A late order is not shown as on time | `feasibility.test.js` PASS 4 |
| 6 | Cancellation updates status and rider availability | `orders.test.js` PASS 4, `extras.test.js` PASS 10 |
| 7 | Cost changes recalculate and raise alerts | `extras.test.js` PASS 2 |
| 8 | Simulator recalculates and resets | `extras.test.js` PASS 11 |
| 9 | Changing the radius changes the comparison | `extras.test.js` PASS 12 |
| 10 | No duplicate alerts, resolved alerts stay traceable | `extras.test.js` PASS 3, 4, 5 |
| 11 | Data persists after restart | `persistence.test.js` PASS 11 |
| 12 | Invalid inputs and status transitions are handled | `contribution.test.js` PASS 4, `orders.test.js` PASS 5 and 9 |

`roles.test.js` covers owner, dispatcher and customer permissions. `customer-commerce.test.js` checks server-side menu pricing, rejection of unknown menu items, safe customer responses, Plus cancellation-window rules, rider release, and subscription status. `auth-tenancy.test.js` tests account registration/login, owner-managed dispatchers, tenant isolation and the customer-to-My-Orders flow.

---

## 7. Demo flow (about 10 minutes)

Before starting: Owner → Settings → **Reset demo data**. The starting data has OD1 to OD10 (each ₹22, Green), rider R1 with 1 free slot and rider R2 full.

**Part 1: Customer (about 2 min)**
1. Open the customer-first home page at `/`. Choose a restaurant and add menu items to the bag.
2. Enter delivery details, review the itemised total, and select demo online payment or cash on delivery.
3. Sign in or create a customer account at checkout. Place the order; it should appear in **My Orders** and open in the animated status tracker. Customer responses never expose internal contribution or rider/support/payment cost assumptions.
4. Activate Lane & Local Plus from the customer navigation to demonstrate membership state and the extended pre-preparation cancellation window. This is a demo membership; no real fee is charged.

**Part 2: Dispatcher and rider capacity (about 3 min)**
4. Sign out, then sign in with a dispatcher account created by the relevant restaurant owner. Open **Smart Feasibility**: Green rows show contribution, rider availability, estimated vs promised time, and the radius result.
5. Open OD11, type a reason and **Accept**. Rider R1 is assigned, and the customer's page updates within seconds.
6. Open OD1 and click **Accept**. It is blocked: zero rider capacity. Click **Reschedule** to see the later slot (+30 min).
7. Open **Rider Management**: zero free capacity is shown, and the dispatcher cannot edit rider capacity.
8. On OD11, **Report preparation delay** of 20 min. The estimate rises past the promise, the order shows Red, and the customer's tracking page shows the delay.

**Part 3: Owner, profit and alerts (about 3 min)**
9. Sign out and sign in to the restaurant owner's account. Open the **What-If Simulator** and pick OD2.
10. Click **Try rider cost ₹85**. Contribution goes from ₹22 to **−₹8**, the result turns Red and the LOSS box appears. Click **Reset to baseline**. Nothing was saved.
11. Set rider cost to 85 again, enter a reason, click **Apply scenario** and confirm.
12. Open **Early-Warning Alerts**. A Critical "Negative contribution" alert and a "Quote affected by cost change" alert appear. **Acknowledge** one, **Resolve** one with a note, and filter by severity.
13. Back on the simulator, set the rider cost to 55 and apply it. The "Negative contribution" alert resolves itself and stays visible under **Resolved**. The informational "cost change" alert stays until you resolve it or the order is closed, so resolve it with a note.

**Part 4: Service radius, extra feature 4 (about 2 min)**
14. **New Delivery Quote**: create an order at **4 km**. It is flagged Red as outside the radius.
15. Open **Dynamic Service Radius** and compare 2, 3 and 5 km. Set the proposed radius to 5 km. Show the change in serviceable orders, edge delivery time (24 → 30 min) and risk. Read the trade-off text.
16. Enter a reason and **Approve change**. The 4 km order is now inside the radius.

**Wrap-up**
17. **Analytics**: status chart, contribution by order, profitable vs unprofitable, rider utilisation. (On-time % appears after a delivered order has an actual time.)
18. **Decision History**: every decision with its reason, cost assumptions and who made it. Click **Export CSV**.
19. **Persistence:** stop the server (`Ctrl+C`), run `npm start` again and refresh. Everything is still there.

---

## 8. Project structure

```
neighbourhood-delivery-desk/
├── README.md
├── Starter_Data/C26/        fixture.json and the case README
├── server/
│   ├── index.js             Express app
│   ├── data/                store.js and db.json (saved data)
│   ├── logic/               contribution, feasibility, riders, alerts, radius,
│   │                        simulator, validation, orders, customer
│   ├── middleware/access.js role-based access rules
│   ├── routes/              orders, riders, alerts, simulator, radius, analytics,
│   │                        history, settings, export, customer
│   └── tests/               scenario and role tests
└── client/src/
    ├── App.jsx, api.js, auth.jsx, nav.js
    ├── components/          Header, Sidebar, StatCard, StatusBadge, OrderTimeline ...
    ├── pages/               Overview, Orders, OrderDetail, QuoteForm, Riders, Feasibility,
    │                        WhatIfSimulator, AlertCentre, ServiceRadius, Analytics,
    │                        DecisionHistory, Settings, RoleSelect
    └── pages/customer/      MyOrders, PlaceOrder, TrackOrder, PremiumMembership
```

---

## 9. Honest limits

- **No live GPS or routing.** Times come from the disclosed model above. Status updates are simulated.
- Authentication uses local password hashes and bearer sessions, but lacks production-grade rate limiting, account recovery, MFA and hardened session management.
- **Restaurants and menus are demo fixtures.** The catalogue is code-defined for the prototype; a future pilot should add merchant/menu management.
- **Payment is simulated.** UPI/online is a clearly labelled demo success only. No payment gateway, refunds or settlement exist yet.
- **Plus membership is simulated.** The illustrative ₹99/month plan is saved in JSON, but no real subscription billing/renewal is processed.
- **Customer cancellation policy:** standard orders can be cancelled while Pending; active Plus members can also cancel while Assigned; all online customer cancellation closes when status becomes Preparing.
- **Customers type their distance.** A real product would work it out from a validated address/location.
- **Customer orders start with the fixture's commercial terms** (15% merchant fee, ₹30 delivery fee, ₹55 rider, ₹8 support, ₹5 payment). The dispatcher or owner decides whether to accept.
- **The fixture has no rider locations and no refund data,** so riders are not ranked by distance and the refund analytics shows an empty state instead of estimates.
- **Persistence is a JSON file,** which is suitable for a prototype and not for many users at once. It does not provide transactional locking for concurrent writes; migrate to PostgreSQL before a real multi-user pilot.

---

## 10. Troubleshooting

| Problem | Fix |
|---|---|
| `Cannot find module './middleware/access'` | The file or folder is missing or misnamed. It must be `server/middleware/access.js`. |
| Page shows "Cannot reach the server" | Start the backend: `cd server`, then `npm start`. |
| Sign-in fails | Check the email/password. Use a seeded demo owner account or register a customer/owner. Dispatchers must be created by an owner. |
| "The dispatcher role is not allowed to do this" | That page or action is owner-only. Switch to Business Owner. |
| Data looks messy after testing | Owner → Settings → Reset demo data. |
| Port already in use | Close the old terminal still running the server, then start again. |