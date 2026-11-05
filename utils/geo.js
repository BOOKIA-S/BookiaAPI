// Distance helpers for GET /api/stores/near (few stores, so plain JS instead of a geo index).
const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees) => (degrees * Math.PI) / 180;

/** Great-circle (haversine) distance in kilometres between two { lat, lng } points. */
function distanceKm(from, to) {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** True for a finite latitude in [-90, 90]. */
const isLatitude = (value) => Number.isFinite(value) && value >= -90 && value <= 90;

/** True for a finite longitude in [-180, 180]. */
const isLongitude = (value) => Number.isFinite(value) && value >= -180 && value <= 180;

module.exports = { distanceKm, isLatitude, isLongitude };
