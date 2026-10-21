# BOOKIA API

API REST de BOOKIA: qué establecimientos de Huauchinango, Puebla venden cada libro, a qué precio y cuántos ejemplares tienen.

Esta carpeta es un proyecto independiente: no depende del frontend y se puede correr, probar y entregar sola. El contrato completo (modelos, cada endpoint y sus respuestas) está en [API_CONTRACT.md](API_CONTRACT.md).

## Stack

- Node.js 22 + Express 5
- MongoDB + Mongoose
- Autenticación con JWT en cookie httpOnly, roles `admin` y `reader` (RBAC), contraseñas con bcrypt
- Seguridad: helmet, CORS con credenciales, límite de intentos de login, saneamiento de operadores `$` en el body
- Bitácora `audit_logs` de toda escritura de administrador
- Calidad: ESLint + Prettier, Jest + Supertest con cobertura mínima de 70 %

## Estructura

```
api/
├── server.js            # punto de entrada: valida .env, conecta a MongoDB, levanta HTTP
├── app.js               # app de Express (middlewares + rutas), sin conexión para poder testearla
├── config/              # variables de entorno, conexión a la BD y constantes
├── routes/              # una ruta por recurso, montadas bajo /api
├── controllers/         # lógica de cada endpoint
├── models/              # esquemas de Mongoose: Book, Store, Offer, User, AuditLog
├── middlewares/         # auth (JWT + roles), validación, manejo de errores
├── utils/               # helpers: errores HTTP, saneamiento, bitácora, cálculo de existencias
├── scripts/             # seed.js y datos de ejemplo
├── tests/               # unit/ e integration/ (Jest + Supertest)
├── requests.http        # peticiones de ejemplo para REST Client (VS Code)
└── postman/             # colección de Postman con las mismas peticiones
```

## Cómo correrla

Requisitos: Node.js 22 y un MongoDB al que conectarse, cualquiera de los dos:

- **MongoDB local**: instala [MongoDB Community Server](https://www.mongodb.com/try/download/community) y deja el servicio corriendo en el puerto 27017. La cadena es `mongodb://127.0.0.1:27017/bookia` (ya viene en `.env.example`). Puedes ver los datos con [MongoDB Compass](https://www.mongodb.com/products/tools/compass).
- **MongoDB Atlas** (nube, plan gratuito): crea un cluster y pon su cadena `mongodb+srv://usuario:password@.../bookia` en `MONGODB_URI`.

```bash
cd api
cp .env.example .env       # en Windows: copy .env.example .env
# Edita .env: JWT_SECRET (texto largo) y ADMIN_PASSWORD (mínimo 8 caracteres)
npm install
npm run seed               # crea el admin y los datos de ejemplo
npm run dev                # API en http://localhost:4000
```

Prueba rápida: `curl http://localhost:4000/api/health` responde `{"status":"ok"}`.

`npm run seed` borra y vuelve a crear libros, establecimientos y ofertas (no toca las cuentas de lector), así que se puede correr cuando quieras volver a los datos de ejemplo. Las tiendas, precios y existencias son ficticios.

### Variables de entorno (`.env`)

| Variable                 | Obligatoria    | Default                 | Para qué                                                                                                       |
| ------------------------ | -------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| `MONGODB_URI`            | sí             |                         | Cadena de conexión, p. ej. `mongodb://127.0.0.1:27017/bookia`                                                  |
| `JWT_SECRET`             | sí             |                         | Firma de los tokens. Genera uno con `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `PORT`                   | no             | `4000`                  | Puerto HTTP                                                                                                    |
| `NODE_ENV`               | no             | `development`           | En `production` la cookie se marca `secure` (solo HTTPS)                                                       |
| `JWT_EXPIRES_IN_SECONDS` | no             | `28800` (8 h)           | Duración de la sesión                                                                                          |
| `CLIENT_URL`             | no             | `http://localhost:5173` | Único origen permitido por CORS                                                                                |
| `BCRYPT_SALT_ROUNDS`     | no             | `12` (mínimo 10)        | Costo del hash de contraseñas                                                                                  |
| `ADMIN_EMAIL`            | solo para seed |                         | Correo del administrador que crea `npm run seed`                                                               |
| `ADMIN_PASSWORD`         | solo para seed |                         | Contraseña de ese administrador                                                                                |

### Scripts

| Comando          | Qué hace                                                                       |
| ---------------- | ------------------------------------------------------------------------------ |
| `npm run dev`    | Levanta la API y la reinicia al guardar cambios                                |
| `npm start`      | Levanta la API (modo normal)                                                   |
| `npm run seed`   | Crea/actualiza el admin y recarga el catálogo de ejemplo                       |
| `npm test`       | Pruebas unitarias e integración con reporte de cobertura (no necesita MongoDB) |
| `npm run lint`   | ESLint sin advertencias permitidas                                             |
| `npm run format` | Formatea con Prettier                                                          |

## Endpoints

Todas las rutas van bajo `/api`. Las respuestas son JSON con campos en snake_case; los errores siempre son `{ "message": "..." }`.

| Método | Ruta                 | Acceso  | Descripción                                                                                                    |
| ------ | -------------------- | ------- | -------------------------------------------------------------------------------------------------------------- |
| GET    | `/health`            | público | Estado de la API                                                                                               |
| GET    | `/books`             | público | Búsqueda paginada con filtros `q`, `genre`, `publisher`, `store_id`, `min_price`, `max_price`, `page`, `limit` |
| GET    | `/books/filters`     | público | Géneros y editoriales disponibles                                                                              |
| GET    | `/books/:id`         | público | Ficha del libro con las tiendas que lo venden                                                                  |
| GET    | `/stores`            | público | Directorio de establecimientos                                                                                 |
| GET    | `/stores/:id`        | público | Establecimiento con su catálogo                                                                                |
| POST   | `/auth/register`     | público | Crea una cuenta de lector e inicia sesión                                                                      |
| POST   | `/auth/login`        | público | Inicia sesión (`portal: "admin"` exige rol admin)                                                              |
| POST   | `/auth/logout`       | público | Cierra sesión                                                                                                  |
| GET    | `/auth/me`           | sesión  | Usuario actual                                                                                                 |
| GET    | `/favorites`         | sesión  | Libros favoritos del usuario                                                                                   |
| PUT    | `/favorites/:bookId` | sesión  | Agrega un favorito                                                                                             |
| DELETE | `/favorites/:bookId` | sesión  | Quita un favorito                                                                                              |
| POST   | `/books`             | admin   | Crea un libro (opcional `initial_offer` con tienda, precio y existencias)                                      |
| PUT    | `/books/:id`         | admin   | Edita un libro                                                                                                 |
| DELETE | `/books/:id`         | admin   | Borra un libro y sus ofertas                                                                                   |
| POST   | `/stores`            | admin   | Crea un establecimiento                                                                                        |
| PUT    | `/stores/:id`        | admin   | Edita un establecimiento                                                                                       |
| DELETE | `/stores/:id`        | admin   | Borra un establecimiento y sus ofertas                                                                         |
| POST   | `/offers`            | admin   | Registra precio y existencias de un libro en una tienda                                                        |
| PUT    | `/offers/:id`        | admin   | Cambia precio o existencias                                                                                    |
| DELETE | `/offers/:id`        | admin   | Quita la oferta                                                                                                |
| GET    | `/audit-logs`        | admin   | Últimas operaciones de escritura                                                                               |

Cada oferta que devuelve la API trae `stock` (ejemplares) y `is_available` (`stock > 0`, calculado, no se guarda).

## Ejemplos

La sesión viaja en la cookie `token`, así que con curl hay que guardarla con `-c` y mandarla con `-b`.

```bash
# Buscar libros de García Márquez de $300 o menos
curl "http://localhost:4000/api/books?q=garc%C3%ADa&max_price=300"

# Iniciar sesión como admin (usa el ADMIN_EMAIL y ADMIN_PASSWORD de tu .env)
curl -c cookies.txt -H "Content-Type: application/json" \
  -d '{"email":"admin@bookia.local","password":"TU_PASSWORD","portal":"admin"}' \
  http://localhost:4000/api/auth/login

# Crear un libro con su primera oferta (cambia STORE_ID por un _id de GET /api/stores)
curl -b cookies.txt -H "Content-Type: application/json" \
  -d '{"title":"Los de abajo","author":"Mariano Azuela","genre":"Novela","initial_offer":{"store_id":"STORE_ID","price":189,"stock":4}}' \
  http://localhost:4000/api/books
```

Respuesta de `GET /api/books?limit=1` con los datos del seed (sin `created_at`/`updated_at`):

```json
{
  "items": [
    {
      "_id": "6ad9204b64dccabd37a00df8",
      "title": "Aritmética",
      "author": "Aurelio Baldor",
      "genre": "Texto escolar",
      "publisher": "Grupo Editorial Patria",
      "edition": "",
      "isbn": "",
      "offers": [
        {
          "_id": "6ad9204b64dccabd37a00e1c",
          "price": 455,
          "stock": 0,
          "is_available": false,
          "store": { "_id": "6ad9204b64dccabd37a00de5", "name": "Papelería Escolar del Centro" }
        },
        {
          "_id": "6ad9204b64dccabd37a00e1b",
          "price": 470,
          "stock": 6,
          "is_available": true,
          "store": { "_id": "6ad9204b64dccabd37a00de4", "name": "Papelería y Librería Necaxa" }
        }
      ],
      "min_price": 470,
      "total_stock": 6
    }
  ],
  "total": 20,
  "page": 1,
  "limit": 1
}
```

`min_price` ignora las ofertas agotadas (por eso es 470 y no 455).

Para probar todo sin escribir comandos:

- **VS Code**: instala la extensión REST Client, abre [requests.http](requests.http) y da clic en "Send Request" sobre cada petición, en orden.
- **Postman**: importa [postman/bookia.postman_collection.json](postman/bookia.postman_collection.json). Cambia las variables `adminEmail` y `adminPassword` de la colección y corre las carpetas en orden; los ids se guardan solos en variables.

## Pruebas

```bash
npm run lint
npm test
```

Las pruebas usan mocks de Mongoose y Supertest contra `app.js`, por lo que no necesitan una base de datos corriendo.

## Problemas comunes

- **`MongooseServerSelectionError` / `ECONNREFUSED 127.0.0.1:27017`**: MongoDB no está corriendo. Revisa que el servicio de MongoDB esté iniciado (en Windows: Servicios > MongoDB Server) o que la cadena de Atlas sea correcta.
- **`Missing required environment variables: JWT_SECRET`**: falta ese valor en `.env`.
- **El login de admin responde 401**: corre `npm run seed` otra vez después de cambiar `ADMIN_EMAIL` o `ADMIN_PASSWORD`.
- **Un cliente en otro puerto recibe error de CORS**: pon su origen en `CLIENT_URL`.

## Repo propio

`api/` ya trae todo lo que necesita para vivir sola: `package.json`, `.env.example`, `.gitignore`, pruebas y su propio workflow de CI en `api/.github/workflows/ci.yml` (dentro de este monorepo GitHub lo ignora; en un repo propio se activa solo). Para sacarla a un repositorio nuevo conservando su historial:

```bash
# desde la raíz del repo de BOOKIA
git subtree split --prefix=api -b api-only
git push https://github.com/USUARIO/bookia-api.git api-only:main
```

El repo nuevo queda con `server.js`, `package.json`, etc. en la raíz y se corre igual que aquí (`npm install`, `npm run seed`, `npm run dev`).
