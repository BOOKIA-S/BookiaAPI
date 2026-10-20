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

// [bookKey, storeKey, priceMxn, isAvailable]
const OFFERS = [
  ['cien', 'azalea', 329, true],
  ['cien', 'necaxa', 345, true],
  ['cien', 'escolar', 299, false],
  ['paramo', 'azalea', 89, true],
  ['paramo', 'necaxa', 79, true],
  ['paramo', 'escolar', 75, true],
  ['llano', 'azalea', 95, true],
  ['llano', 'escolar', 85, false],
  ['laberinto', 'azalea', 249, true],
  ['laberinto', 'necaxa', 239, false],
  ['aura', 'azalea', 139, true],
  ['aura', 'necaxa', 129, true],
  ['batallas', 'azalea', 149, true],
  ['balun', 'azalea', 199, false],
  ['espiritus', 'azalea', 319, true],
  ['ficciones', 'azalea', 279, true],
  ['ficciones', 'necaxa', 289, true],
  ['rayuela', 'azalea', 399, true],
  ['chocolate', 'azalea', 259, true],
  ['chocolate', 'necaxa', 249, false],
  ['quijote', 'azalea', 449, true],
  ['quijote', 'necaxa', 469, true],
  ['odisea', 'necaxa', 119, true],
  ['odisea', 'escolar', 109, true],
  ['principito', 'azalea', 159, true],
  ['principito', 'necaxa', 149, true],
  ['principito', 'escolar', 139, true],
  ['matilda', 'azalea', 229, true],
  ['potter', 'azalea', 389, true],
  ['potter', 'necaxa', 379, false],
  ['anafrank', 'escolar', 99, true],
  ['algebra', 'necaxa', 520, true],
  ['algebra', 'escolar', 489, true],
  ['aritmetica', 'necaxa', 470, true],
  ['aritmetica', 'escolar', 455, false],
  ['larousse', 'necaxa', 359, true],
  ['larousse', 'escolar', 339, true],
];

module.exports = { STORES, BOOKS, OFFERS };
