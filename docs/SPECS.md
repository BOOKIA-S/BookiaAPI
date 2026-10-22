# BOOKIA: especificaciones del proyecto

Documento único que reúne las especificaciones de BOOKIA: producto, reglas de la Carta Constitución, alcance del MVP, modelos de datos, API, pantallas y los sistemas en construcción.

Fuentes: Carta Constitución de Bookia, plan "BOOKIA: resumen y alcance del MVP" (2026-10-20), [`api/API_CONTRACT.md`](../api/API_CONTRACT.md) y el código actual del repositorio.

Última actualización: 2026-10-22.

---

## 1. Producto

BOOKIA es una plataforma web que centraliza la información bibliográfica y comercial (título, autor, género, editorial, edición, precio y disponibilidad) de los libros que venden las librerías y papelerías de **Huauchinango, Puebla**, para que cualquier persona sepa desde un solo lugar en qué comercio local está el título que busca.

**Problema.** Hoy hay que ir o llamar a cada tienda para preguntar disponibilidad, precio y edición. Las herramientas generales (Amazon, Google Books) no muestran la oferta local, y muchas mipymes no tienen presencia digital propia.

**Hipótesis H1 (la que el MVP debe demostrar).** El sistema permite localizar, desde un único punto de consulta, los títulos disponibles en los establecimientos registrados.

### Usuarios y roles

| Rol | Clave | Qué puede hacer |
| --- | --- | --- |
| Visitante | (sin sesión) | Buscar y filtrar libros, ver fichas de libro y de establecimiento |
| Lector | `reader` | Lo anterior, más registrarse, iniciar sesión, editar su nombre y guardar favoritos |
| Administrador | `admin` | CRUD de libros, establecimientos y ofertas; consultar la bitácora de auditoría |
| Encargado de tienda | `store_owner` | **En construcción** (ver sección 7.1): gestiona solo la oferta de su tienda |

---

## 2. Stack y reglas de la Carta Constitución

### Tecnología

- **Frontend:** React (SPA) con Vite y React Router, estilos solo con Tailwind CSS, estado global con Context API.
- **Backend:** Node.js LTS con Express, API REST.
- **Base de datos:** MongoDB con Mongoose como ODM, modelo de documentos con referencias entre colecciones.
- Solo versiones estables/LTS; nada en Beta ni Deprecated.
- Dependencias npm solo con licencia MIT o Apache 2.0.

### Seguridad

- Autenticación con JWT en cookie `httpOnly`, `secure` (en producción) y `sameSite: 'strict'`.
- Autorización RBAC: middlewares (`requireAuth`, `requireRole`) validan el rol antes de cualquier controlador.
- Contraseñas con bcrypt, mínimo 10 rondas. Nunca en texto plano.
- Secretos y cadena de conexión solo desde variables de entorno con `dotenv`. Prohibido hardcodear credenciales.
- Prohibido construir filtros de Mongoose con interpolación no validada; todo valor externo se sanitiza (se eliminan claves con `$` o `.`).

### Rendimiento

- Endpoints por debajo de 200 ms en operación normal.
- Índices en las consultas de lectura masiva o filtrado frecuente.
- Una sola conexión a MongoDB al arrancar, reutilizada y cerrada de forma controlada al terminar el proceso.

### Estándares de código

- `camelCase` en variables, funciones y rutas de Express; `PascalCase` en componentes React; `snake_case` en campos de Mongoose; `SCREAMING_SNAKE_CASE` en constantes globales y variables de entorno.
- Todo el código y los comentarios en inglés.
- ESLint + Prettier sin advertencias antes de integrar.
- Ningún archivo de más de 300 líneas.
- Estructura del backend (`api/`): `config/`, `controllers/`, `routes/`, `middlewares/`, `models/` (más `utils/`, `scripts/`, `tests/`).
- Estructura del frontend (`frontend/src/`): `components/`, `hooks/`, `pages/`, `services/` (más `context/`).

### Gobernanza

- Privacidad conforme a GDPR y normativa local cuando se capturen datos personales.
- Toda alta, cambio o baja de libros, establecimientos u ofertas genera una entrada en `audit_logs` (usuario, acción, entidad, fecha y hora).

### Testing y CI

- Cobertura mínima del 70% en la lógica de negocio del backend y en utilitarios críticos del frontend.
- Pruebas unitarias de controladores con mocks de MongoDB y pruebas de integración de los endpoints principales (Jest + Supertest; Vitest en el frontend).
- Pipeline de GitHub Actions que corre lint y pruebas antes de cualquier despliegue.

### Decisiones descartadas

- Sin SQL ni bases relacionales.
- Sin Next.js ni SSR.
- Sin Bootstrap ni estilos en línea en JSX.
- Sin Redux salvo necesidad estricta.
- Sin Docker en el repositorio: MongoDB local o Atlas mediante `MONGODB_URI`.

---

## 3. Alcance del MVP

### Incluido

1. **Catálogo de establecimientos:** nombre, dirección, teléfono, horario y enlace a Google Maps.
2. **Catálogo de libros** con metadatos inspirados en Dublin Core: título, autor, género, editorial, edición e ISBN (opcional).
3. **Oferta por establecimiento:** relación libro y tienda con precio y existencias (`stock`); la disponibilidad se deriva de `stock > 0`.
4. **Búsqueda pública** por título, autor o ISBN, con filtros por género, editorial, establecimiento y rango de precio.
5. **Ficha del libro** con todas las tiendas donde se encuentra, precio, existencias y contacto.
6. **Panel de administración** con login, rol `admin` y CRUD de libros, establecimientos y ofertas.
7. **Bitácora de auditoría** (`audit_logs`).
8. **Datos semilla** de establecimientos reales de Huauchinango (`npm run seed` en `api/`).
9. **Cuentas de lector con favoritos y perfil** (se agregó después del plan original).

### Fuera del MVP

- Venta en línea, carrito y pagos. (El apartado sin pago está en construcción, ver 7.2.)
- Reseñas o calificaciones.
- Mapa interactivo embebido, geolocalización o "tienda más cercana".
- Importación masiva por CSV o integración con inventarios.
- App móvil nativa (la web es responsiva).
- Recomendaciones o búsqueda con IA.

---

## 4. Modelos de datos

Todos los modelos usan `created_at` y `updated_at` (salvo `AuditLog`, que solo tiene `created_at`) y no tienen `__v`.

### Store (`stores`)

| Campo | Tipo | Reglas |
| --- | --- | --- |
| `name` | String | Requerido, máx. 150 |
| `address` | String | Requerido, máx. 300 |
| `phone` | String | Máx. 40 |
| `schedule` | String | Máx. 200 |
| `maps_url` | String | URL http(s), máx. 500 |

Índice: `name`.

### Book (`books`)

| Campo | Tipo | Reglas |
| --- | --- | --- |
| `title` | String | Requerido, máx. 200 |
| `author` | String | Requerido, máx. 150 |
| `genre` | String | Máx. 80 |
| `publisher` | String | Máx. 120 |
| `edition` | String | Máx. 80 |
| `isbn` | String | Vacío o 10 a 17 dígitos, guiones o X |

Índices: texto en `title` (peso 3) y `author` (peso 1) en español; simples en `title`, `author`, `genre`, `publisher`, `isbn`.

### Offer (`offers`)

| Campo | Tipo | Reglas |
| --- | --- | --- |
| `book_id` | ObjectId → Book | Requerido |
| `store_id` | ObjectId → Store | Requerido |
| `price` | Number | Requerido, 0 a 1,000,000 |
| `stock` | Number (entero) | Requerido, 0 a 100,000 |

- Único por `book_id + store_id`.
- `is_available` (= `stock > 0`) se calcula en cada respuesta; nunca se guarda.
- Índices: `{ store_id, price }`, `{ price }`, `{ book_id, stock, price }`.

### User (`users`)

| Campo | Tipo | Reglas |
| --- | --- | --- |
| `email` | String | Requerido, único, minúsculas, máx. 254 |
| `name` | String | Máx. 80 |
| `password_hash` | String | Requerido, nunca se devuelve (`select: false`) |
| `role` | String | `admin` o `reader` (por defecto `reader`) |
| `favorite_book_ids` | ObjectId[] → Book | Máx. 200 |

### AuditLog (`audit_logs`)

| Campo | Tipo | Reglas |
| --- | --- | --- |
| `user_id` | ObjectId → User | Requerido |
| `action` | String | `create`, `update` o `delete` |
| `entity` | String | `book`, `store` u `offer` |
| `entity_id` | ObjectId | Requerido |

Índice: `created_at` descendente.

### Relaciones

```
Store 1 ──< Offer >── 1 Book
User  >──< Book   (favorite_book_ids)
User  1 ──< AuditLog
```

---

## 5. API (resumen de `api/API_CONTRACT.md`)

Base: `/api` (local `http://localhost:4000/api`). JSON con campos en `snake_case`. Errores como `{ "message": string }`. El contrato completo y los ejemplos están en [`api/API_CONTRACT.md`](../api/API_CONTRACT.md), [`api/requests.http`](../api/requests.http) y la colección de Postman en `api/postman/`.

### Públicos (sin sesión)

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/health` | `{ status: "ok" }` |
| GET | `/books` | Búsqueda paginada. Query: `q`, `genre`, `publisher`, `store_id`, `min_price`, `max_price`, `page`, `limit` (máx. 100). Cada libro trae `offers`, `min_price` y `total_stock` |
| GET | `/books/filters` | `{ genres, publishers }` para los filtros |
| GET | `/books/:id` | Libro con sus ofertas (tienda completa) y `total_stock` |
| GET | `/stores` | Lista de establecimientos ordenada por nombre |
| GET | `/stores/:id` | Establecimiento con sus ofertas (libro resumido) |

### Autenticación

| Método | Ruta | Descripción |
| --- | --- | --- |
| POST | `/auth/register` | `{ name, email, password }` → 201, rol `reader`, deja la cookie; 409 si el email existe |
| POST | `/auth/login` | `{ email, password, portal? }`; con `portal: "admin"` un no admin recibe 403 |
| POST | `/auth/logout` | 204, borra la cookie |
| GET | `/auth/me` | Usuario actual o 401 |
| PATCH | `/auth/me` | Cambia solo `name` (1 a 80 caracteres) |

`register` y `login` comparten un límite de 20 peticiones por 15 minutos por IP (429).

### Lector (cualquier sesión)

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/favorites` | Favoritos, el más reciente primero |
| PUT | `/favorites/:bookId` | Agrega (idempotente, máx. 200) |
| DELETE | `/favorites/:bookId` | Quita |

### Administrador (rol `admin`, toda escritura audita)

| Método | Ruta | Descripción |
| --- | --- | --- |
| POST | `/books` | Crea libro; acepta `initial_offer: { store_id, price, stock }` |
| PUT / DELETE | `/books/:id` | Edita / borra (borra también sus ofertas) |
| POST | `/stores` | Crea establecimiento |
| PUT / DELETE | `/stores/:id` | Edita / borra (borra también sus ofertas) |
| POST | `/offers` | `{ book_id, store_id, price, stock }`; 409 si ya existe esa pareja |
| PUT / DELETE | `/offers/:id` | Edita / borra |
| GET | `/audit-logs?limit=50` | Últimas entradas (máx. 200) |

### Códigos de error

`400` validación o id inválido · `401` sin sesión o sesión inválida · `403` rol insuficiente · `404` no existe · `409` duplicado · `413` cuerpo mayor a 100 KB · `429` demasiados intentos · `500` error inesperado (sin detalles al cliente).

### Configuración local

- API en el puerto 4000; CORS solo para `CLIENT_URL` (por defecto `http://localhost:5173`) con credenciales.
- El servidor de Vite redirige `/api` a `http://localhost:4000`.
- Variables principales: `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN_SECONDS`, `CLIENT_URL`, `PORT` (ver `.env.example`).

---

## 6. Pantallas y rutas del frontend

Definidas en [`frontend/src/App.jsx`](../frontend/src/App.jsx). Todas usan el `Layout` común (encabezado con buscador y avatar, pie de página).

### Públicas

| Ruta | Página | Contenido |
| --- | --- | --- |
| `/` | `HomePage` | Búsqueda con filtros (género, editorial, establecimiento, precio), resultados paginados con `BookCard` y estado de disponibilidad |
| `/libros/:id` | `BookDetailPage` | Ficha del libro con todas las tiendas, precio, existencias y botón de favorito |
| `/establecimientos` | `StoresPage` | Lista de establecimientos |
| `/establecimientos/:id` | `StoreDetailPage` | Datos de contacto, horario, mapa y libros que ofrece |
| `/ingresar` | `LoginPage` | Inicio de sesión y registro de lectores |
| `/favoritos` | `FavoritesPage` | Libros guardados por el lector |
| `/perfil` | `ProfilePage` | Datos del lector y edición de su nombre |
| `/admin/login` | `AdminLoginPage` | Acceso al panel (con `portal: "admin"`) |
| `*` | `NotFoundPage` | Página 404 |

### Panel de administración (protegido por `ProtectedRoute`, rol `admin`)

| Ruta | Página | Contenido |
| --- | --- | --- |
| `/admin` | | Redirige a `/admin/libros` |
| `/admin/libros` | `BooksAdmin` | CRUD de libros, con oferta inicial opcional |
| `/admin/establecimientos` | `StoresAdmin` | CRUD de establecimientos |
| `/admin/ofertas` | `OffersAdmin` | CRUD de ofertas (precio y existencias por tienda) |
| `/admin/bitacora` | `AuditLogAdmin` | Consulta de la bitácora |

---

## 7. Sistemas en construcción

Estas funciones se están desarrollando y todavía no están en `main`. Lo que sigue es la especificación acordada.

### 7.1 Rol encargado de tienda (`store_owner`)

- Nuevo valor de `role`: `store_owner`, ligado a **un solo** establecimiento (por ejemplo un campo `store_id` en `User`).
- Solo puede ver y gestionar las ofertas (precio y existencias) **de su tienda**, y en su caso los datos de contacto de la misma. Cualquier intento sobre otra tienda responde 403.
- No puede crear ni borrar establecimientos ni ver la bitácora completa; eso sigue siendo del `admin`.
- El `admin` da de alta a los encargados y les asigna su tienda.
- Sus cambios también se registran en `audit_logs`.
- El panel muestra solo las secciones que le corresponden a su rol.

### 7.2 Reservas (apartado de libros)

- Un lector con sesión puede apartar ejemplares de una oferta para recogerlos en la tienda. **No hay pago en línea**: se paga en el establecimiento.
- Estados:

| Estado | Significado |
| --- | --- |
| `pendiente` | Creada por el lector, esperando que la tienda la confirme |
| `confirmada` | La tienda aceptó y tiene los ejemplares apartados |
| `entregada` | El lector recogió y pagó en tienda |
| `cancelada` | La canceló el lector o la tienda |
| `vencida` | Pasaron 48 h sin entregarse |

- **Stock apartado:** al crear la reserva se descuenta la cantidad del `stock` disponible de la oferta (o se lleva un contador de apartados), de modo que otros lectores no puedan apartar los mismos ejemplares. Si se cancela o vence, los ejemplares vuelven a estar disponibles. Si no alcanza el stock, la reserva se rechaza.
- **Vigencia:** 48 horas desde su creación; al vencer pasa a `vencida` y libera el stock.
- Transiciones: `pendiente → confirmada | cancelada | vencida`, `confirmada → entregada | cancelada | vencida`. `entregada`, `cancelada` y `vencida` son finales.
- El lector ve y cancela sus reservas; el `store_owner` (y el `admin`) ve y gestiona las de su tienda.
