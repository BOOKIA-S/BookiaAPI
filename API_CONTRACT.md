# BOOKIA API contract (shared by backend and frontend)

Base URL: `/api`. JSON everywhere. Field names are snake_case. Errors: `{ "message": string }` with proper HTTP status.

## Models
- **Store**: `_id, name, address, phone, schedule, maps_url, created_at, updated_at`
- **Book**: `_id, title, author, genre, publisher, edition, isbn, created_at, updated_at` (text index on title+author)
- **Offer**: `_id, book_id (ref Book), store_id (ref Store), price (Number), stock (integer >= 0, copies in the store)` (unique index book_id+store_id)
  - Every offer returned by the API also carries a derived `is_available` (= `stock > 0`). It is read-only and never stored.
- **User**: `_id, email, password_hash, role ('admin')`
- **AuditLog** (collection `audit_logs`): `user_id, action ('create'|'update'|'delete'), entity ('book'|'store'|'offer'), entity_id, created_at`

## Public endpoints
- `GET /api/health` -> `{ status: "ok" }`
- `GET /api/books?q=&genre=&publisher=&store_id=&min_price=&max_price=&page=1&limit=20`
  -> `{ items: [ { ...Book, offers: [ { _id, price, stock, is_available, store: { _id, name } } ], min_price, total_stock } ], total, page, limit }`
  (books that have no offer matching store/price filters are excluded when those filters are given)
- `GET /api/books/filters` -> `{ genres: string[], publishers: string[] }`
- `GET /api/books/:id` -> `{ ...Book, offers: [ { _id, price, stock, is_available, store: Store } ], total_stock }`
- `GET /api/stores` -> `Store[]`
- `GET /api/stores/:id` -> `{ ...Store, offers: [ { _id, price, stock, is_available, book: { _id, title, author } } ] }`

## Auth (JWT in cookie `token`, httpOnly, secure in production, sameSite strict)
- `POST /api/auth/register` body `{ name, email, password (>= 8 chars) }` -> 201 `{ user }` (role `reader`) + sets cookie; 409 if the email exists
- `POST /api/auth/login` body `{ email, password, portal? }` -> `{ user: { _id, email, name, role } }` + sets cookie; with `portal: "admin"` non-admins get 403
- `GET /api/favorites` (any signed-in user) -> `{ items: [ { _id, title, author, genre, publisher } ] }`
- `PUT|DELETE /api/favorites/:bookId` -> `{ book_ids }`
- `POST /api/auth/logout` -> 204, clears cookie
- `GET /api/auth/me` -> `{ user }` or 401

## Admin endpoints (require role admin; every write creates an audit_logs entry)
- `POST /api/books`, `PUT /api/books/:id`, `DELETE /api/books/:id` (deleting a book deletes its offers)
- `POST /api/books` accepts an optional `initial_offer: { store_id, price (> 0), stock (integer >= 0) }`; the book and offer are created together (the book is removed if the offer fails) and the response includes `offers: [offer]`
- `POST /api/stores`, `PUT /api/stores/:id`, `DELETE /api/stores/:id` (deleting a store deletes its offers)
- `POST /api/offers` body `{ book_id, store_id, price, stock }`, `PUT /api/offers/:id`, `DELETE /api/offers/:id`
- `GET /api/audit-logs?limit=50` -> latest entries

Dev: backend on port 4000, frontend Vite on 5173 with proxy `/api` -> `http://localhost:4000`.

`min_price` is the lowest price among offers with `stock > 0` (null if none). `total_stock` is the sum of `stock` over the returned offers.
