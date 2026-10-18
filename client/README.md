# Lane & Local — Frontend

React + Vite frontend using React Router, Recharts, lucide-react and CSS. The design uses DM Serif Display headings, DM Sans interface text, warm ivory, forest green, sage and coral accents.

## Start

Start the Express API in a separate terminal first:

```bash
cd server
npm install
npm start
```

Then start the frontend:

```bash
cd client
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). The dev server proxies `/api` to `http://localhost:5000`.

## Main customer routes

- `/` — customer-first restaurant/menu ordering entry.
- `/login` — customer/owner registration and sign-in.
- `/my-orders/new` — customer ordering and checkout.
- `/my-orders` — current signed-in customer's orders.
- `/my-orders/:id` — animated order status tracker.
- `/premium` — demo membership management.

## Staff routes

- `/overview` — owner/dispatcher dashboard.
- `/orders`, `/orders/new`, `/riders`, `/feasibility`, `/simulator`, `/alerts`, `/radius`, `/analytics`, `/history`, `/settings` — existing operations pages.
- `/team` — owner-only dispatcher management.

## Notes

- Authentication is handled by the Express API with bearer sessions. Customer and owner accounts can register; dispatchers are created by restaurant owners.
- Customer cart and in-progress checkout values are kept in browser storage to survive the sign-in redirect. Completed orders are read back from the API, not solely from local component state.
- Online payment and Plus membership are clearly marked simulations; no real payment provider is connected.
- Restaurant data and orders persist in the JSON-backed Express store for this prototype.
