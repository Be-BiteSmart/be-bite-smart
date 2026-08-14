/**
 * The site's one Series, "Paws To Prevent" (see series-taxonomy.php in the
 * Custom Post Types for BBS plugin — it seeds exactly this term). Download
 * card block instances aren't CPT-backed (see the plugin-architecture split
 * in memory — this plugin owns blocks only, no content model), so there's
 * no live taxonomy term for a block to read here; this constant just
 * mirrors the seeded Series term's slug for blocks that need a
 * deterministic per-series anchor id (see anchor-id.js).
 *
 * If a second series is ever added, anchorPrefix-based blocks will need a
 * real series picker control instead of this hardcoded constant.
 */
export const CURRENT_SERIES_SLUG = "paws-to-prevent";
