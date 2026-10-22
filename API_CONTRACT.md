# BOOKIA API contract

Base URL: `/api` (local: `http://localhost:4000/api`). JSON everywhere. Field names are snake_case.
Errors: `{ "message": string }` with the proper HTTP status (see [Errors](#errors)).

## Models

- **Store**: `_id, name (required), address (required), phone, schedule, maps_url (http/https URL), created_at, updated_at`
- **Book**: `_id, title (required), author (required), genre, publisher, edition, isbn (10-17 digits, dashes or X), created_at, updated_at`
- **Offer**: `_id, book_id (ref Book), store_id (ref Store), price (Number >= 0), stock (integer >= 0, copies in the store), created_at, updated_at`
  - Unique per `book_id + store_id`: a store has at most one offer for each book.
  - Every offer returned by the API also carries a derived `is_available` (= `stock > 0`). It is read-only, never stored and ignored if sent.
- **User**: `_id, email (unique), name, password_hash (never returned), role ('admin' | 'reader'), favorite_book_ids (ref Book[])`
  - Public shape returned by the API: `{ _id, email, name, role }`.
- **AuditLog** (collection `audit_logs`): `_id, user_id, action ('create'|'update'|'delete'), entity ('book'|'store'|'offer'), entity_id, created_at`

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
- `POST /api/auth/login` body `{ email, password, portal? }` -> `{ user }` + sets cookie; 401 on bad credentials; with `portal: "admin"` non-admins get 403
- `POST /api/auth/logout` -> 204, clears cookie
- `GET /api/auth/me` -> `{ user }` or 401
- `PATCH /api/auth/me` body `{ name (1-80 chars) }` -> `{ user }` with the new name; 400 if the name is empty; 401 without a session. Email, role and password cannot be changed here.

`user` is `{ _id, email, name, role, created_at }`.

`register` and `login` share a rate limit of 20 requests per 15 minutes per IP (429 when exceeded).

## Reader endpoints (any signed-in user, reader or admin)

- `GET /api/favorites` -> `{ items: [ { _id, title, author, genre, publisher } ] }` (most recently saved first)
- `PUT /api/favorites/:bookId` -> `{ book_ids }` (idempotent; 404 if the book does not exist; max 200 favorites)
- `DELETE /api/favorites/:bookId` -> `{ book_ids }`

## Admin endpoints (role `admin`; every write creates an `audit_logs` entry)

- `POST /api/books` body `{ title, author, genre?, publisher?, edition?, isbn?, initial_offer? }` -> 201 Book
  - Optional `initial_offer: { store_id, price (> 0), stock (integer >= 0) }`: the book and its first offer are created together (the book is removed again if the offer fails) and the response includes `offers: [offer]`.
- `PUT /api/books/:id` (any Book field) -> Book; `DELETE /api/books/:id` -> 204 (also deletes its offers)
- `POST /api/stores` body `{ name, address, phone?, schedule?, maps_url? }` -> 201 Store
- `PUT /api/stores/:id` -> Store; `DELETE /api/stores/:id` -> 204 (also deletes its offers)
- `POST /api/offers` body `{ book_id, store_id, price, stock }` -> 201 Offer (with `is_available`); 400 if the book or store does not exist; 409 if that store already has an offer for the book
- `PUT /api/offers/:id` (any of `price`, `stock`, `book_id`, `store_id`) -> Offer; `DELETE /api/offers/:id` -> 204
- `GET /api/audit-logs?limit=50` -> latest entries first (`limit` max 200)

Unknown body fields are ignored. Fields with a leading `$` or containing `.` are stripped before reaching the database.

## Errors

| Status | When                                                                    |
| ------ | ----------------------------------------------------------------------- |
| 400    | Validation failed, malformed id or JSON body                            |
| 401    | No session, or the session expired / is invalid                         |
| 403    | Signed in without the required role (or reader on `portal: "admin"`)    |
| 404    | Resource or route not found                                             |
| 409    | Duplicate (email already registered, offer for the same book and store) |
| 413    | Body larger than 100 KB                                                 |
| 429    | Too many register/login attempts                                        |
| 500    | Unexpected error (details are logged, never returned)                   |

## Dev setup

API on port 4000. CORS allows only `CLIENT_URL` (default `http://localhost:5173`) with credentials; the BOOKIA frontend's Vite dev server proxies `/api` -> `http://localhost:4000`.
