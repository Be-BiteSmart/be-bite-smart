import { CURRENT_SERIES_SLUG } from "./series";

/** Same normalization as WordPress's sanitize_title(): lowercase, non-alphanumerics collapsed to hyphens, trimmed. */
function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Deterministic per-instance anchor id for a download-card block, e.g.
 * "coloring-books-paws-to-prevent-ep-1" — mirrors
 * bitesmart_episode_anchor_id() in episode-display.php, the same
 * "give the real embed a stable anchor id, link to it" pattern, so a
 * Resource entry's URL can be typed once from the Episode # alone instead
 * of copy-pasted from the block editor.
 *
 * Only computable once both anchorPrefix (a per-block-type config, e.g.
 * "coloring-books" for custom/educational-coloring-book-download) and
 * episodeNumber are set. Returns null otherwise — callers fall back to a
 * temporary random id (see edit.js), same as the episode anchor's
 * title-slug fallback for episodes with no number yet.
 *
 * @param {string} anchorPrefix
 * @param {string} episodeNumber
 * @return {string|null}
 */
export function computeSeriesAnchorId(anchorPrefix, episodeNumber) {
  if (!anchorPrefix || !episodeNumber) {
    return null;
  }
  return [anchorPrefix, CURRENT_SERIES_SLUG, "ep-" + slugify(episodeNumber)].join("-");
}
