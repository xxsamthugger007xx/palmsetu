/** Within-sign degree/minute readout from an absolute ecliptic longitude
 * (0-360). Shared by HomeScreen's InstrumentDial readouts and the kundli
 * chart result screen's planetary-details table, so both format degrees
 * identically. */
export function degreeReadout(longitude: number): string {
  const withinSign = ((longitude % 30) + 30) % 30;
  const deg = Math.floor(withinSign);
  const min = Math.round((withinSign - deg) * 60);
  return `${deg}°${String(min).padStart(2, '0')}′`;
}
