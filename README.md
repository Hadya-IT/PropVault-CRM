# PropVault CRM — Week 1 foundation

React + Zustand + Tailwind (client) · Node/Express (server) · Oracle ATP · Microsoft Entra SSO

## What is in this build
- **Dynamic entities and modules.** Admins create entities and assign any module from the library, with a menu label, order, on/off switch and an optional fixed filter (e.g. JS gets the Units module twice: "Office Units" with category=Office and "Retail Showrooms" with category=Retail).
- **Module library (Phase 1):** Units, Leads, Pipeline, Activities, Deals, Customers/Members, Bookings, Maintenance, Events, CX. The Overview and Reports screens follow in week 4.
- **Security**
  - Microsoft sign-in (PKCE, no secret in the browser). The server verifies the ID token: signature, tenant, audience and expiry.
  - Only users added under Admin → Users can sign in.
  - Session lives in an httpOnly, SameSite=Strict signed cookie. There is no token in localStorage.
  - Every API call checks, on the server, that the module is assigned and enabled for that entity and that the user's role in that entity allows the action.
  - SQL uses bind variables only. Column names come from a code whitelist, never from the request.
  - Referenced ids must belong to the same entity.
  - Optimistic locking (row_version) and soft delete.
  - Audit log on every write and every config change.
  - Helmet/CSP, CSRF header, rate limits, 100 KB body limit.
  - Booking clash prevention uses a row lock.
- **Responsive:** sidebar drawer on mobile, card lists on phones, tables on tablet and desktop.
- **Tailwind only:** no inline styles anywhere. `src/index.css` contains only `@import "tailwindcss"`, which Tailwind v4 needs as its entry point.

## Setup
1. **Database:** run `db/01_schema.sql`, then `db/02_seed.sql`. The seed asks for `BOOTSTRAP_ADMIN_EMAIL`; enter your own email.
2. **Server**
   ```
   cd server && cp .env.example .env
   ```
   - Fill in `SESSION_SECRET` and the DB/wallet values.
   - Then run `npm install && npm run dev`.
3. **Client**
   ```
   cd client && cp .env.example .env
   npm install && npm run dev
   ```
   Then open http://localhost:5173.
4. **Tests:** `cd server && npm test` (27 tests: permissions, SQL safety, auth/CSRF/CORS).

## Entra app (PropVault CRM)
Already configured:
- SPA platform with redirect URI `http://localhost:5173` (Auth Code + PKCE)
- Implicit grant: off
- Single tenant
- `User.Read` permission

**Before go-live:** add the production URL as a second SPA redirect URI.

SSO does **not** need a client secret. The secret created on this app was shared in chat, so delete or rotate it under Certificates & secrets. Email (Graph `Mail.Send` from d365@hadya.com) will use a **separate** app registration, limited by an Application Access Policy.

## Next (week 2)
- JS screens in full: entity-specific fields (field_definitions → attrs)
- Lead detail with activities timeline
- Contract Signed → auto Deal + unit status
- CSV import
