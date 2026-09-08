# GQ DevTools Lab

Manual QA classroom lab for Chrome DevTools: Elements, Console, Network, API preconditions, reusable QA utility functions, and Teacher Mode.

## Run locally

```bash
node server.js
```

Open `http://localhost:3000`.

Optional private Teacher PIN:

```bash
TEACHER_PIN="your-private-pin" node server.js
```

Default local training PIN: `GQ2026`.

## New API workflow practice

The UI now includes real training flows for:
- `POST /api/customers`
- `POST /api/policies`
- `GET /api/policies/:id`
- `PATCH /api/policies/:id`
- `POST /api/policies/:id/cancel`
- `POST /api/claims`
- `POST /api/payments`

Students perform the action in the UI, inspect it in Network, use Copy as fetch, run it in Console, and then convert it into a reusable function.

The challenge board includes 12 QA Utility Function exercises covering `createCustomer`, `createPolicy`, `createClaim`, `createPayment`, `updatePolicy`, `cancelPolicy`, `getPolicy`, bulk creation, and Chrome DevTools Snippets.

Teacher solutions are hidden by default and are fetched from the server only after Teacher Mode is unlocked.

All data is in memory and resets when the Node server restarts.


## Function progression
The QA Utility Functions track now teaches: Copy as fetch -> fixed function -> parameters -> default values -> chained precondition helpers -> saving the final toolkit in Chrome DevTools Snippets.
