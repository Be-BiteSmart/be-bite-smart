# Change log

## 2026-05-29 — AddToAny share UTM tracking (child theme)

**What was built and why:** AddToAny share buttons should send visitors to the current page with consistent UTM parameters (`utm_source=word_of_mouth`, `utm_medium=share`, `utm_campaign=site_share`) so shared links are attributable in analytics.

**Files created or modified:**
- `app/public/wp-content/themes/twentytwentyfive-child/inc/addtoany.php` — sets `a2a_config.linkurl` in `wp_head` (page URL without existing query string + UTMs)
- `app/public/wp-content/themes/twentytwentyfive-child/functions.php` — `require_once` for `addtoany.php`
- `app/public/wp-content/CHANGES.md` — this entry

**Patterns or conventions followed from the codebase:**
- Same `inc/` + `require_once` pattern as `inc/analytics.php`
- `wp_add_inline_script( 'addtoany-core', …, 'before' )` at priority `20` so UTMs run after the plugin’s inline config

**Problems encountered and how they were fixed:**
- `a2a_config.linkurl` in `wp_head` did not apply to X/Twitter shares — the plugin resets `a2a_config.callbacks` in its own inline script and direct service buttons use the click-time URL. Fixed by hooking `addtoany-core` at enqueue priority `20` and using AddToAny’s `share` callback to set `data.url` with UTMs on every share
- `data-a2a-url` in page HTML stays as the plain permalink until JS runs — expected; `ready` callback now syncs `.a2a_kit[data-a2a-url]` after AddToAny loads (inspector should show UTMs after load, not only on click)

**TODOs:**
- None

**What the next logical step would be:**
- Share a page via AddToAny, open the shared link, and confirm UTMs appear in the landing URL and in Plausible/analytics

## 2026-05-29 — Episode card language toggle defaults to Spanish (TranslatePress)

**What was built and why:** Episode cards are static blocks saved with the EN toggle active and “Watch Now”. When TranslatePress serves the site in Spanish, each card should start on ES (slider position, active label, “Ver Ahora”, and `data-vimeo-es` when play is clicked) without re-saving blocks in the editor.

**Files created or modified:**

- `app/public/wp-content/plugins/custom-blocks-for-be-bite-smart/src/includes/site-lang.php` — shared `bitesmart_site_lang_code()`; `render_block` filter adds `data-site-lang` on `custom/episode-card` output
- `app/public/wp-content/plugins/custom-blocks-for-be-bite-smart/custom-blocks-for-be-bite-smart.php` — loads `site-lang.php` at plugin bootstrap
- `app/public/wp-content/plugins/custom-blocks-for-be-bite-smart/src/video-quote/video-quote.php` — uses shared `bitesmart_site_lang_code()` instead of a duplicate helper
- `app/public/wp-content/plugins/custom-blocks-for-be-bite-smart/src/video-toggle.js` — `setEpisodeLanguage()` applies ES UI on load when `data-site-lang` or document is Spanish; click handler refactored to same helper
- `app/public/wp-content/plugins/custom-blocks-for-be-bite-smart/build/video-toggle.js` — compiled output (`pnpm run build`)
- `app/public/wp-content/plugins/custom-blocks-for-be-bite-smart/src/episode-card/index.js` — comment documenting editor save vs front-end default
- `app/public/wp-content/CHANGES.md` — this entry

**Patterns or conventions followed from the codebase:**

- Same TranslatePress → `en`|`es` detection as video-quote (`trp_get_current_language`, `$TRP_LANGUAGE`, `trp_user_language`, JS fallbacks on `html[lang]` and `body.translatepress-es_`*)
- Static block + runtime fix via shared `video-toggle.js` (episode-card HTML in post content is not re-saved per language)
- `render_block` injection for server-rendered `data-site-lang` on episode cards (mirrors video-quote dynamic attribute)

**Problems encountered and how they were fixed:**

- Episode-card `save()` runs in the editor once and stores the same HTML for every visitor (EN toggle active, “Watch Now”). It cannot know which language TranslatePress will use when someone loads the page later.
- The first paint is therefore always that saved English markup (server-rendered HTML). Language for the current request is applied afterward: PHP `render_block` adds `data-site-lang` when TRP is serving Spanish, then `video-toggle.js` on `DOMContentLoaded` reads that (or `html[lang]` / body class) and updates the toggle UI and play target to ES. We did not change `save()` in the editor, because that would only bake in one default at publish time—not per visitor or per TRP language.
- This targets visitors **on the Spanish version of the site** (e.g. `/es/…`).

**TODOs:**

- Brief flash of EN-active toggle possible before JS runs (skipped — would need PHP to rewrite toggle classes in `render_block` or inline script)
- No listener if user switches TRP language without full page reload (skipped — same as video-quote; typical TRP navigation reloads)

**What the next logical step would be:**

- Open Education in Spanish, confirm each episode card shows ES selected and plays `data-vimeo-es` on Watch Now
- Confirm analytics `episodes-watched-spanish` fires when play is clicked (existing `getLang` reads `.toggle-label.active`)

## 2026-05-29 — Video quote Vimeo language defaults (TranslatePress)

**What was built and why:** When the site is viewed in Spanish via TranslatePress, the mini-documentary (`custom/video-quote`) Vimeo player should default to Spanish audio and subtitles on the same video ID. The block uses one Vimeo URL (unlike episode cards with separate EN/ES IDs), so the embed URL now passes Vimeo’s `texttrack=es` and `audiotrack=es` when the site language is Spanish.

**Files created or modified:**

- `app/public/wp-content/plugins/custom-blocks-for-be-bite-smart/src/video-quote/video-quote.php` — added `video_quote_site_lang_code()` (TranslatePress / locale); outputs `data-site-lang` on the block `<article>`
- `app/public/wp-content/plugins/custom-blocks-for-be-bite-smart/src/video-toggle.js` — for `.video-quote-block` only, sets `currentLang` from `data-site-lang` or document fallback; `buildVimeoPlayerSrc()` appends Spanish track params to the iframe URL
- `app/public/wp-content/plugins/custom-blocks-for-be-bite-smart/build/video-toggle.js` — compiled output from `pnpm run build`
- `app/public/wp-content/CHANGES.md` — this entry

**Patterns or conventions followed from the codebase:**

- Dynamic PHP render + shared `video-toggle.js` enqueue (same as existing video-quote / episode-card flow in `custom-blocks-for-be-bite-smart.php`)
- TranslatePress detection aligned with theme analytics: `trp_get_current_language()` when available, plus `html[lang]` and `body.translatepress-es_`* fallbacks in JS
- Vimeo URL params consistent with `src/qr-experience/partials.php` (`texttrack` on embed); extended with `audiotrack` per Vimeo player docs
- Episode cards unchanged: EN/ES still driven by `.toggle-label` and `data-vimeo-en` / `data-vimeo-es`

**Problems encountered and how they were fixed:**

- First build attempt used `npm run build`; project uses pnpm — rebuilt with `pnpm run build` after user correction
- Initial CHANGES.md entry omitted required sections (TODOs, problems, full paths) — corrected in this update

**TODOs:**

- Plausible `documentary-watched` event still has no language variant (skipped — out of scope for this task; analytics.php would need a small follow-up)
- Not verified against live Vimeo assets — Spanish tracks must exist on the hosted video or Vimeo ignores the params

**What the next logical step would be:**

- On a Spanish URL (or after switching to Spanish), open a page with `video-quote`, play the mini-documentary, and confirm Spanish audio/subtitles in the Vimeo player
- If tracks do not appear, confirm in Vimeo Studio that `es` audio and text tracks exist for that video ID
- Optionally add `-spanish` / `-english` to `documentary-watched` in `app/public/wp-content/themes/twentytwentyfive-child/inc/analytics.php` using the same language detection

## 2026-05-26 — Video quote stacked layout

**What was built and why:** The Documentary Video (`video-quote`) block now keeps the video above the quote text on all screen sizes. Previously, at 900px+ the flex row placed video and text side by side.

**Files modified:**

- `plugins/custom-blocks-for-be-bite-smart/src/video-quote/style.css` — removed row/50% split at large breakpoints; video and text columns stay full width; watch button centered at all breakpoints
- `plugins/custom-blocks-for-be-bite-smart/src/video-quote/video-quote.php` — thumbnail `sizes` updated from half-width `420px` to full-width `90vw`
- `plugins/custom-blocks-for-be-bite-smart/build/video-quote/style-index.css` (and RTL) — rebuilt via `npm run build`

**Patterns followed:** Existing BEM-style class names and column flex on `.video-quote-content-wrapper`; PHP markup unchanged (video already precedes text in DOM).

**Next step:** Hard-refresh the frontend and confirm layout inside the theme’s content width; adjust `gap` or max video width if the design calls for a narrower player on very wide screens.