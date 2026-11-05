const { normalizeIsbn, isValidIsbn, isbnVariants, isbnStoredPattern } = require('../../utils/isbn');

describe('isbn utils', () => {
  it('normalizes dashes, spaces and a lowercase x', () => {
    expect(normalizeIsbn(' 978-0-306 40615-7 ')).toBe('9780306406157');
    expect(normalizeIsbn('0-8044-2957-x')).toBe('080442957X');
    expect(normalizeIsbn(9780306406157)).toBeUndefined();
  });

  it.each(['9780306406157', '0306406152', '080442957X', '9791032300824'])(
    'accepts the valid ISBN %s',
    (isbn) => expect(isValidIsbn(isbn)).toBe(true)
  );

  it.each(['9780306406158', '0306406153', '12345', 'abcdefghij', '1234567890123', 'X306406152'])(
    'rejects %s',
    (isbn) => expect(isValidIsbn(isbn)).toBe(false)
  );

  it('returns the ISBN-10/13 equivalents', () => {
    expect(isbnVariants('9780306406157')).toEqual(['9780306406157', '0306406152']);
    expect(isbnVariants('0306406152')).toEqual(['0306406152', '9780306406157']);
    expect(isbnVariants('080442957X')).toEqual(['080442957X', '9780804429573']);
    expect(isbnVariants('9791032300824')).toEqual(['9791032300824']);
  });

  it('matches stored ISBNs with or without dashes, and nothing else', () => {
    const pattern = isbnStoredPattern('9780306406157');
    expect(pattern.test('978-0-306-40615-7')).toBe(true);
    expect(pattern.test('9780306406157')).toBe(true);
    expect(pattern.test('97803064061570')).toBe(false);
    expect(pattern.test('19780306406157')).toBe(false);
    expect(isbnStoredPattern('080442957X').test('0-8044-2957-x')).toBe(true);
  });
});
