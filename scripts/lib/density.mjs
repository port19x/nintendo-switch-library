/**
 * Density: "how much quality per hour of my life".
 *
 * The brief is "short games that are at least decent", which is two ideas:
 *   - a quality floor — below SCORE_FLOOR a game scores 0 no matter how short
 *   - diminishing tolerance for length
 *
 *   density = (metascore - SCORE_FLOOR) / hours ^ TIME_EXPONENT
 *
 * TIME_EXPONENT < 1 damps the division so a 90-minute curiosity does not bury
 * every excellent 10-hour game: at 0.7, a game twice as long needs ~1.6x the
 * quality-above-floor to tie, rather than 2x.
 *
 * Worked examples, all real rows (Main + Extra):
 *   Neva              87 @   4.5h -> 12.9
 *   Splatoon 3        83 @  14.5h ->  5.1
 *   Tears of the Kdm  96 @ 117.2h ->  1.6
 *   a 55-rated 2h toy 55 @   2.0h ->  3.1   (floor keeps mediocrity down)
 */

export const SCORE_FLOOR = 50;
export const TIME_EXPONENT = 0.7;

/**
 * @param {number|null} metascore 0-100
 * @param {number|null} hours Main + Extra playtime
 * @returns {number|null} null when either input is missing
 */
export function densityScore(metascore, hours) {
  if (typeof metascore !== 'number' || typeof hours !== 'number' || !(hours > 0)) return null;
  const quality = metascore - SCORE_FLOOR;
  if (quality <= 0) return 0;
  return Number((quality / hours ** TIME_EXPONENT).toFixed(1));
}

export const DENSITY_FORMULA = `(metascore − ${SCORE_FLOOR}) ÷ hours^${TIME_EXPONENT}`;
