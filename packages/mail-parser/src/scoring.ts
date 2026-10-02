/**
 * Shared scoring helpers.
 *
 * Both detectors publish their arithmetic so a score can be argued with rather than
 * merely displayed. They also share the rounding rule here, so the two cannot drift
 * apart on how a number is presented.
 *
 * @module
 */

/**
 * Round a score to two decimal places.
 *
 * Present because the arithmetic is sums and differences of tenths, and floating point
 * produces values like `0.15000000000000002`. That is not a cosmetic concern: a score
 * this package hands to a client will eventually be rendered as a percentage, and
 * "15.000000000000002%" is a bug the user would see. It also makes a corpus expectation
 * expressible as a readable number.
 *
 * Two places rather than more, because anything finer is noise for a judgement that is
 * explicitly not a probability.
 */
export function roundConfidence(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Clamp a score into the shared model's range, rounded.
 *
 * The clamp is a second line of defence in both detectors: each one's maximum is
 * already defined so it cannot be reached, and this keeps that promise true if someone
 * adds a rule later. A score that would exceed the ceiling is reduced rather than
 * trusted, because the promise is about what the product says, not about what the
 * arithmetic permits.
 *
 * @param value The score to clamp.
 * @param bounds The inclusive range a score may occupy.
 * @returns The rounded score, inside `bounds`.
 */
export function clampConfidence(
  value: number,
  bounds: { readonly min: number; readonly max: number },
): number {
  const rounded = roundConfidence(value);
  if (rounded < bounds.min) {
    return bounds.min;
  }
  return rounded > bounds.max ? bounds.max : rounded;
}
