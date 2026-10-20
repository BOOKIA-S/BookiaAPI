// SAMPLE DATA ONLY. The stores below are fictional businesses invented for demos;
// names, street numbers and phone numbers are plausible for Huauchinango centro
// but do not refer to real establishments. Book titles are real, well-known works;
// ISBNs are intentionally left empty to avoid publishing incorrect identifiers.

const CITY_SUFFIX = 'Centro, 73160 Huauchinango, Pue.';

function mapsUrlFor(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function buildStore(key, name, street, phone, schedule) {
  const address = `${street}, ${CITY_SUFFIX}`;
  return { key, name, address, phone, schedule, maps_url: mapsUrlFor(address) };
}

const STORES = [
  buildStore(
    'azalea',
    'Librería Azalea',
    'Av. Benito Juárez 112',
    '776 762 0145',
    'Lun-Sáb 9:00-20:00, Dom 10:00-14:00'
  ),
  buildStore(
    'necaxa',
    'Papelería y Librería Necaxa',
    'Calle Guerrero 45',
    '776 762 3381',
    'Lun-Sáb 8:30-20:30'
  ),
  buildStore(
    'escolar',
    'Papelería Escolar del Centro',
    'Calle Morelos 28',
    '776 762 5520',
    'Lun-Vie 8:00-19:00, Sáb 9:00-15:00'
  ),
];

function buildBook(key, title, author, genre, publisher, edition = '') {
  return { key, title, author, genre, publisher, edition, isbn: '' };
}

const BOOKS = [
  buildBook('cien', 'Cien años de soledad', 'Gabriel García Márquez', 'Novela', 'Debolsillo'),
  buildBook('paramo', 'Pedro Páramo', 'Juan Rulfo', 'Novela', 'Editorial RM'),
  buildBook('llano', 'El llano en llamas', 'Juan Rulfo', 'Cuento', 'Editorial RM'),
  buildBook(
    'laberinto',
    'El laberinto de la soledad',
    'Octavio Paz',
    'Ensayo',
    'Fondo de Cultura Económica'
  ),
  buildBook('aura', 'Aura', 'Carlos Fuentes', 'Novela', 'Ediciones Era'),
  buildBook(
    'batallas',
    'Las batallas en el desierto',
    'José Emilio Pacheco',
    'Novela',
    'Ediciones Era'
  ),
  buildBook('balun', 'Balún Canán', 'Rosario Castellanos', 'Novela', 'Fondo de Cultura Económica'),
  buildBook('espiritus', 'La casa de los espíritus', 'Isabel Allende', 'Novela', 'Debolsillo'),
  buildBook('ficciones', 'Ficciones', 'Jorge Luis Borges', 'Cuento', 'Debolsillo'),
  buildBook('rayuela', 'Rayuela', 'Julio Cortázar', 'Novela', 'Alfaguara'),
  buildBook('chocolate', 'Como agua para chocolate', 'Laura Esquivel', 'Novela', 'Debolsillo'),
  buildBook(
    'quijote',
    'Don Quijote de la Mancha',
    'Miguel de Cervantes',
    'Clásico',
    'Alfaguara',
    'Edición RAE'
  ),
  buildBook('odisea', 'La Odisea', 'Homero', 'Clásico', 'Editorial Porrúa', 'Sepan cuantos...'),
  buildBook('principito', 'El principito', 'Antoine de Saint-Exupéry', 'Infantil', 'Emecé'),
  buildBook('matilda', 'Matilda', 'Roald Dahl', 'Infantil', 'Alfaguara Infantil'),
  buildBook(
    'potter',
    'Harry Potter y la piedra filosofal',
    'J. K. Rowling',
    'Juvenil',
    'Salamandra'
  ),
  buildBook(
    'anafrank',
    'El diario de Ana Frank',
    'Ana Frank',
    'Biografía',
    'Editores Mexicanos Unidos'
  ),
  buildBook('algebra', 'Álgebra', 'Aurelio Baldor', 'Texto escolar', 'Grupo Editorial Patria'),
  buildBook(
    'aritmetica',
    'Aritmética',
    'Aurelio Baldor',
    'Texto escolar',
    'Grupo Editorial Patria'
  ),
  buildBook('larousse', 'Pequeño Larousse Ilustrado', 'Larousse', 'Referencia', 'Larousse'),
];

// [bookKey, storeKey, priceMxn, stock] (stock = copies on hand; 0 means sold out)
const OFFERS = [
  ['cien', 'azalea', 329, 4],
  ['cien', 'necaxa', 345, 2],
  ['cien', 'escolar', 299, 0],
  ['paramo', 'azalea', 89, 6],
  ['paramo', 'necaxa', 79, 9],
  ['paramo', 'escolar', 75, 12],
  ['llano', 'azalea', 95, 3],
  ['llano', 'escolar', 85, 0],
  ['laberinto', 'azalea', 249, 2],
  ['laberinto', 'necaxa', 239, 0],
  ['aura', 'azalea', 139, 5],
  ['aura', 'necaxa', 129, 3],
  ['batallas', 'azalea', 149, 7],
  ['balun', 'azalea', 199, 0],
  ['espiritus', 'azalea', 319, 4],
  ['ficciones', 'azalea', 279, 3],
  ['ficciones', 'necaxa', 289, 0],
  ['rayuela', 'azalea', 399, 6],
  ['chocolate', 'azalea', 259, 8],
  ['chocolate', 'necaxa', 249, 0],
  ['quijote', 'azalea', 449, 2],
  ['quijote', 'necaxa', 469, 1],
  ['odisea', 'necaxa', 119, 10],
  ['odisea', 'escolar', 109, 15],
  ['principito', 'azalea', 159, 6],
  ['principito', 'necaxa', 149, 4],
  ['principito', 'escolar', 139, 11],
  ['matilda', 'azalea', 229, 3],
  ['potter', 'azalea', 389, 5],
  ['potter', 'necaxa', 379, 0],
  ['anafrank', 'escolar', 99, 7],
  ['algebra', 'necaxa', 520, 9],
  ['algebra', 'escolar', 489, 14],
  ['aritmetica', 'necaxa', 470, 6],
  ['aritmetica', 'escolar', 455, 0],
  ['larousse', 'necaxa', 359, 3],
  ['larousse', 'escolar', 339, 8],
];

module.exports = { STORES, BOOKS, OFFERS };
