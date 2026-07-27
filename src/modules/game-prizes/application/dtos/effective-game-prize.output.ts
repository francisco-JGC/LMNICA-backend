/**
 * Payout multipliers for a single game AT a specific sucursal, with the
 * override merged over the game's default. `exactMultiplier`/`easyMultiplier`/
 * `pairEasyMultiplier` are the effective values the client should use;
 * `*Default` are the game's baseline (unchanged by overrides) so the UI can
 * show them as placeholders. `hasOverride` toggles UI affordances (delete
 * button, highlight, etc.).
 *
 * `pairEasy*` is only meaningful for THREE_DIGIT games; null on every other
 * type (the game itself won't have a default set).
 */
export interface EffectiveGamePrizeOutput {
  gameId: string;
  /**
   * Slug del juego. La UI lo usa para gatear qué campos renderizar — en
   * particular, "premio par" es un knob de Juega 3 y solo se muestra para
   * ese slug.
   */
  gameSlug: string;
  gameName: string;
  /**
   * Game type so the UI can decide which fields to render. Only THREE_DIGIT
   * has an easy multiplier at all.
   */
  gameType: string;
  exactDefault: number | null;
  easyDefault: number | null;
  pairEasyDefault: number | null;
  exactMultiplier: number | null;
  easyMultiplier: number | null;
  pairEasyMultiplier: number | null;
  overrideId: string | null;
  overrideExact: number | null;
  overrideEasy: number | null;
  overridePairEasy: number | null;
  hasOverride: boolean;
}

export interface ListEffectiveGamePrizesOutput {
  items: EffectiveGamePrizeOutput[];
}
