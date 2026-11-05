const { distanceKm, isLatitude, isLongitude } = require('../../utils/geo');

describe('geo utils', () => {
  it('computes haversine distances in km', () => {
    const point = { lat: 20.1757, lng: -98.0527 };
    expect(distanceKm(point, point)).toBe(0);
    // One degree of latitude is ~111.2 km.
    expect(distanceKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111.19, 1);
    // Huauchinango -> Ciudad de México zócalo is ~140 km in a straight line.
    expect(distanceKm(point, { lat: 19.4326, lng: -99.1332 })).toBeCloseTo(139, -1);
  });

  it('validates coordinate ranges', () => {
    expect(isLatitude(20.17)).toBe(true);
    expect(isLatitude(91)).toBe(false);
    expect(isLatitude(undefined)).toBe(false);
    expect(isLongitude(-98.05)).toBe(true);
    expect(isLongitude(-181)).toBe(false);
  });
});
