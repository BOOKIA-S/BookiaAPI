# BOOKIA API contract

Base URL: `/api` (local: `http://localhost:4000/api`). JSON everywhere. Field names are snake_case.
Errors: `{ "message": string }` with the proper HTTP status (see [Errors](#errors)).

## Models

- **Store**: `_id, name (required), address (required), phone, schedule, maps_url (http/https URL), created_at, updated_at`
- **Book**: `_id, title (required), author (required), genre, publisher, edition, isbn (10-17 digits, dashes or X), created_at, updated_at`
- **Offer**: `_id, book_id (ref Book), store_id (ref Store), price (Number >= 0), stock (integer >= 0, copies in the store), created_at, updated_at`
  - Unique per `book_id + store_id`: a store has at most one offer for each book.
  - Every offer returned by the API also carries a derived `is_available` (= `stock > 0`). It is read-only, never stored and ignored if sent.
- **User**: `_id, email (unique), name, password_hash (never returned), role ('admin' | 'reader' | 'store_owner'), store_id (ref Store), favorite_book_ids (ref Book[])`
  - `store_id` is required for `store_owner` (the only store that account manages) and `null` for the other roles.
  - Public shape returned by the API: `{ _id, email, name, role, store_id, created_at }`.
- **Reservation**: `_id, user_id (ref User), offer_id (ref Offer), store_id (ref Store), book_id (ref Book), price (unit price when reserved), quantity (integer 1-5), status ('pendiente' | 'confirmada' | 'entregada' | 'cancelada' | 'vencida'), expires_at, created_at, updated_at`
  - Reserving takes the copies out of the offer's `stock` at once (atomic, stock never goes below 0). Cancelling or expiring gives them back; delivering keeps them out (sold).
  - A `pendiente` or `confirmada` reservation expires 48 h after it was made (`expires_at`). Expiry is applied on every reservation request and by a sweep every 5 minutes.
  - Reservation responses also carry the populated refs as `book { _id, title, author }`, `store { _id, name, address, phone, schedule }` and, for managers, `user { _id, name, email }`.
- **AuditLog** (collection `audit_logs`): `_id, user_id, action ('create'|'update'|'delete'), entity ('book'|'store'|'offer'|'user'), entity_id, created_at`

## Public endpoints (no session)

- `GET /api/health` -> `{ status: "ok" }`
- `GET /api/books?q=&genre=&publisher=&store_id=&min_price=&max_price=&page=1&limit=20`
  -> `{ items: [ { ...Book, offers: [ { _id, price, stock, is_available, store: { _id, name } } ], min_price, total_stock } ], total, page, limit }`
  - `q` searches title, author and ISBN (case-insensitive). `genre` and `publisher` are exact matches.
  - `store_id`, `min_price` and `max_price` filter offers; books without a matching offer are excluded when any of them is given.
  - `limit` max 100. Items sorted by title; offers sorted by price.
- `GET /api/books/filters` -> `{ genres: string[], publishers: string[] }`
- `GET /api/books/:id` -> `{ ...Book, offers: [ { _id, price, stock, is_available, store: Store } ], total_stock }`
- `GET /api/stores` -> `Store[]` (sorted by name)
- `GET /api/stores/:id` -> `{ ...Store, offers: [ { _id, price, stock, is_available, book: { _id, title, author } } ] }`

`min_price` is the lowest price among offers with `stock > 0` (null if none). `total_stock` is the sum of `stock` over the returned offers.

## Auth

The JWT travels only in the cookie `token` (httpOnly, `secure` in production, `sameSite=strict`, lifetime `JWT_EXPIRES_IN_SECONDS`). Clients must send cookies back (browser `credentials: "include"`, Postman/REST Client keep them automatically).

- `POST /api/auth/register` body `{ name, email, password (8-200 chars) }` -> 201 `{ user }` with role `reader` + sets cookie; 409 if the email exists
- `POST /api/auth/login` body `{ email, password, portal? }` -> `{ user }` + sets cookie; 401 on bad credentials; with `portal: "admin"` only `admin` and `store_owner` accounts may sign in (readers get 403)
- `POST /api/auth/logout` -> 204, clears cookie
- `GET /api/auth/me` -> `{ user }` or 401
- `PATCH /api/auth/me` body `{ name (1-80 chars) }` -> `{ user }` with the new name; 400 if the name is empty; 401 without a session. Email, role and password cannot be changed here.

`user` is `{ _id, email, name, role, store_id, created_at }` (`store_id` is `null` unless the role is `store_owner`).

`register` and `login` share a rate limit of 20 requests per 15 minutes per IP (429 when exceeded).

## Roles

| Role          | Who                            | Can                                                                              |
| ------------- | ------------------------------ | -------------------------------------------------------------------------------- |
| `reader`      | Self-registered visitor        | Favorites and profile                                                            |
| `store_owner` | Account created by an admin    | Edit its own store (`PUT /api/stores/:id`) and that store's offers. No favorites |
| `admin`       | General administrator (seeded) | Everything below, including owner accounts                                       |

Store-scoped routes use the middleware `require_store_access(store_id_getter, { optional })` (`middlewares/storeAccess.js`): admins always pass, a `store_owner` passes only when the store id returned by the getter equals `req.user.store_id`, anyone else gets 403. `requireAuth` fills `req.user.store_id`.

## Reader endpoints (reader or admin; `store_owner` gets 403)

- `GET /api/favorites` -> `{ items: [ { _id, title, author, genre, publisher } ] }` (most recently saved first)
- `PUT /api/favorites/:bookId` -> `{ book_ids }` (idempotent; 404 if the book does not exist; max 200 favorites)
- `DELETE /api/favorites/:bookId` -> `{ book_ids }`

## Reservations (signed-in users; no online payment, the reader pays in the store)

- `POST /api/reservations` body `{ offer_id, quantity? (1-5, default 1) }` -> 201 Reservation with status `pendiente`. Role `reader` only (403 otherwise). 404 if the offer does not exist; 409 if the offer has fewer copies than `quantity`; 400 if the reader already has 10 active reservations.
- `GET /api/reservations/mine` -> `{ items: Reservation[] }` of the signed-in user, most recent first (max 200)
- `PATCH /api/reservations/:id/cancel` -> Reservation; the owner cancels a `pendiente` or `confirmada` reservation (copies return to stock). 404 if it is not theirs; 409 if it is no longer active.

Reservation desk (role `admin`, or `store_owner` limited to their own `store_id`):

- `GET /api/reservations/manage?status=&store_id=` -> `{ items: Reservation[] }` most recent first (max 200). Admins see every store and may filter by `store_id`; a store owner only ever sees their store.
- `PATCH /api/reservations/:id/status` body `{ status }` -> Reservation. Allowed changes: `pendiente -> confirmada`, `pendiente|confirmada -> entregada`, `pendiente|confirmada -> cancelada` (copies return to stock). 400 for any other target status; 404 if the reservation does not exist or belongs to another store; 409 if its current status does not allow the change.

## Store management (role `admin`, or `store_owner` on its own store; every write creates an `audit_logs` entry)

- `PUT /api/stores/:id` body any of `{ name, address, phone, schedule, maps_url }` -> Store; a store owner gets 403 for any other store
- `POST /api/offers` body `{ book_id, store_id, price, stock }` -> 201 Offer (with `is_available`); 400 if the book or store does not exist; 409 if that store already has an offer for the book; a store owner gets 403 unless `store_id` is its store
- `PUT /api/offers/:id` (any of `price`, `stock`, `book_id`, `store_id`) -> Offer; `DELETE /api/offers/:id` -> 204. A store owner gets 403 when the offer belongs to another store (or does not exist), and when `store_id` would move it to another store

## Admin endpoints (role `admin` only; every write creates an `audit_logs` entry)

- `POST /api/books` body `{ title, author, genre?, publisher?, edition?, isbn?, initial_offer? }` -> 201 Book
  - Optional `initial_offer: { store_id, price (> 0), stock (integer >= 0) }`: the book and its first offer are created together (the book is removed again if the offer fails) and the response includes `offers: [offer]`.
- `PUT /api/books/:id` (any Book field) -> Book; `DELETE /api/books/:id` -> 204 (also deletes its offers)
- `POST /api/stores` body `{ name, address, phone?, schedule?, maps_url? }` -> 201 Store
- `DELETE /api/stores/:id` -> 204 (also deletes its offers); 409 while store owner accounts are assigned to it
- `GET /api/audit-logs?limit=50` -> latest entries first (`limit` max 200)

### Store owner accounts (`/api/users`, admin only)

`owner` is `{ _id, email, name, role: 'store_owner', store_id, store: { _id, name } | null, created_at }`.

- `GET /api/users` -> `{ items: owner[] }` (store owners only, sorted by email)
- `POST /api/users` body `{ name, email, password (8-200 chars), store_id }` -> 201 `{ user: owner }`; 400 on validation or when the store does not exist; 409 if the email exists. The role is always `store_owner`.
- `PATCH /api/users/:id` body `{ store_id?, name? }` -> `{ user: owner }` (reassigns the store); 404 if the id is not a store owner
- `DELETE /api/users/:id` -> 204; 404 if the id is not a store owner (admins and readers cannot be deleted here)

Unknown body fields are ignored. Fields with a leading `$` or containing `.` are stripped before reaching the database.

## Errors

| Status | When                                                                                                                                                                 |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400    | Validation failed, malformed id or JSON body                                                                                                                         |
| 401    | No session, or the session expired / is invalid                                                                                                                      |
| 403    | Signed in without the required role, store owner outside its store, or reader on `portal: "admin"`                                                                   |
| 404    | Resource or route not found                                                                                                                                          |
| 409    | Duplicate (email, offer for the same book and store), deleting a store with owners, not enough copies to reserve, or a reservation status change that is not allowed |
| 413    | Body larger than 100 KB                                                                                                                                              |
| 429    | Too many register/login attempts                                                                                                                                     |
| 500    | Unexpected error (details are logged, never returned)                                                                                                                |

## Dev setup

API on port 4000. CORS allows only `CLIENT_URL` (default `http://localhost:5173`) with credentials; the BOOKIA frontend's Vite dev server proxies `/api` -> `http://localhost:4000`.
