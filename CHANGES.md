# Change log

## 2026-06-17 — Analytics tests: `/education` → `/learn/`

**What was built and why:** Production returns 404 for `/education`; the Learn page slug is `/learn/`. Analytics specs now use a shared `EDUCATION_PATH` constant so CI passes against the live site.

**Files modified:**

- `app/public/wp-content/tests/analytics/helpers/plausible.js` — export `EDUCATION_PATH = "/learn/"`
- `app/public/wp-content/tests/analytics/events.spec.js` — all education-page navigations use `EDUCATION_PATH`
- `app/public/wp-content/tests/videos/loading.spec.js` — import shared constant (removed local duplicate)
- `app/public/wp-content/CHANGES.md` — this entry

**Next step:** Run `pnpm playwright test` from `app/public/wp-content` to confirm the full suite.

## 2026-06-17 — Playwright video loading tests

**What was built and why:** Added Playwright tests that verify Vimeo embeds actually load (not just analytics events): correct iframe `src`, thumbnail hidden, and a successful `player.vimeo.com` network response.

**Files created or modified:**

- `app/public/wp-content/tests/videos/helpers/videos.js` — shared helpers (`expectedVimeoPlayerSrc`, `assertVimeoPlayerLoads`, episode `data-videos` parsing)
- `app/public/wp-content/tests/videos/loading.spec.js` — documentary (home + learn) and episode video loading specs
- `app/public/wp-content/playwright.config.js` — `testDir` set to `./tests` so analytics and video suites both run
- `app/public/wp-content/CHANGES.md` — this entry

**Patterns or conventions followed from the codebase:**

- Reused `gotoExpectOk` from `tests/analytics/helpers/plausible.js`
- Vimeo URL params mirror `src/video-toggle.js` (`autoplay`, `texttrack` / `audiotrack` for ES/HI)
- Education page path via shared `EDUCATION_PATH` in `plausible.js`

**Problems encountered and how they were fixed:**

- `/education` returns 404 on production — tests use `/learn/` via `EDUCATION_PATH`
- Switching episode language while a video is playing opens the restart modal — episode multi-language test reloads the page per language so each run starts from a clean state

**TODOs:**

- Optional: add a spec for mid-play language switch (confirm modal → new embed loads)

**What the next logical step would be:**

- Run full suite: `pnpm playwright test` from `app/public/wp-content`
- Point `PLAYWRIGHT_BASE_URL` at local/staging when testing unpublished changes

## 2026-05-29 — Editable language-switch dialog (block editor)

**What was built and why:** Editors can change confirm-dialog wording without code. Site-wide copy is stored in WordPress (`bitesmart_lang_restart_dialog`), edited from any Video Episode block sidebar → **Language switch dialog**, and passed to the front end via `bitesmartLangRestartDialog`.

**How to use:** Open a Video Episode block → sidebar → **Language switch dialog** → edit title/message/buttons per dialog language (English / Spanish / Hindi sections). Use `{language}` in message and confirm text for the target language name. Click **Save dialog text**. **Reset to defaults** restores built-in copy.

**Files created or modified:**

- `src/includes/lang-restart-dialog.php` — defaults, option, REST `GET/POST /bitesmart/v1/lang-restart-dialog`
- `src/episode-card/lang-restart-dialog-panel.js` — inspector panel + save
- `src/episode-card/index.js` — wires panel into InspectorControls
- `src/video-lang-restart-modal.js` — reads `window.bitesmartLangRestartDialog`, `{language}` placeholder
- `custom-blocks-for-be-bite-smart.php` — require + localize on `video-toggle`
- `build/*` — `pnpm run build`

## 2026-05-29 — Episode language restart: dialog in playing language

**What was built and why:** Confirm modal copy uses the **language currently playing** (not the segment clicked), so a mistaken tap on another language still shows a prompt they understand—e.g. watching EN and tapping HI shows English: “The video will restart in Hindi.”

**Files modified:** `src/video-lang-restart-modal.js`, `src/video-toggle.js`, `build/video-toggle.js` (`pnpm run build`)

## 2026-05-29 — Episode language restart: accessible modal

**What was built and why:** `window.confirm` for mid-play language switches is hard for screen readers and off-brand. Replaced with a single page-level dialog (`role="dialog"`, `aria-modal`, labelled title/description, focus trap, Escape/backdrop cancel, focus return to the segment).

**Files created or modified:**

- `app/public/wp-content/plugins/custom-blocks-for-be-bite-smart/src/video-lang-restart-modal.js` — `confirmLanguageRestart()` Promise API, EN/ES/HI copy
- `app/public/wp-content/plugins/custom-blocks-for-be-bite-smart/src/video-lang-restart-modal.css` — overlay + panel styles (theme accent buttons)
- `app/public/wp-content/plugins/custom-blocks-for-be-bite-smart/src/video-toggle.js` — uses modal instead of `window.confirm`
- `app/public/wp-content/plugins/custom-blocks-for-be-bite-smart/custom-blocks-for-be-bite-smart.php` — enqueues `build/video-toggle.css` with script
- `app/public/wp-content/plugins/custom-blocks-for-be-bite-smart/build/video-toggle.js` (+ `video-toggle.css`) — `pnpm run build`

**Patterns or conventions followed from the codebase:**

- One shared dialog on `document.body` (same enqueue scope as `video-toggle.js` on education + front page)
- Button styling aligned with `block-toggle-btn` / accent-2

**Verification:**

- Play episode → switch language → Cancel / backdrop / Escape → picker reverts, same video
- Confirm → one reload in new language
- Tab cycles only Cancel / Switch buttons while open

## 2026-05-29 — Third episode language: Hindi (not French)

**What was built and why:** Site language config listed French (`fr`) as the third episode language; the client uses Hindi (`hi`) instead.

**Files created or modified:**

- `app/public/wp-content/plugins/custom-blocks-for-be-bite-smart/src/includes/site-lang.php` — `hi` / Hindi / `hindi` analytics
- `app/public/wp-content/plugins/custom-blocks-for-be-bite-smart/src/shared/languages.js` — default languages list
- `app/public/wp-content/plugins/custom-blocks-for-be-bite-smart/src/video-toggle.js` — Hindi watch label, confirm copy, Vimeo `hi` track params
- `app/public/wp-content/themes/twentytwentyfive-child/inc/analytics.php` — `hindi` Plausible suffix
- `app/public/wp-content/tests/analytics/helpers/plausible.js` — `hi` / `hindi` mappings
- `app/public/wp-content/tests/analytics/events.spec.js` — segment `hi` → `hindi`
- `app/public/wp-content/plugins/custom-blocks-for-be-bite-smart/build/*` — `pnpm run build`
- `app/public/wp-content/CHANGES.md` — this entry

**TODOs:** If any block `videosByLang` was saved with key `fr`, re-enter URLs under Hindi in the editor.

## 2026-05-29 — Episode language switch: confirm before restart

**What was built and why:** Tapping EN/ES/HI while a video was playing immediately replaced the Vimeo iframe and started a new stream—rapid toggling could trigger multiple reloads. Language changes during playback now require a confirm dialog; cancel restores the active segment to the language currently playing.

### Problem

In `video-toggle.js`, segment clicks previously called `setEpisodeLanguage(lang, true)`. When `isPlaying` was true, that immediately ran `loadVideo()`—destroying the iframe and loading another Vimeo embed (separate ID per language).

Each toggle = full player restart + new stream. Rapid clicking multiplies Vimeo traffic and hurts UX. The load is browser ↔ Vimeo, not WordPress—but it is still wasteful and annoying.

### Chosen UX

**Confirm restart:** While a video is playing, changing the language segment opens a browser confirm: *“Switch to [language]? The video will restart.”* Reload only if the user accepts. Cancel restores the active segment to the language currently playing.

- **Not playing:** Segment click only updates selection + Watch CTA (no iframe).
- **Playing, same language:** No-op (no confirm, no reload).
- **Playing, different language:** Confirm → on OK, one `loadVideo()`; on Cancel, revert picker to `playingLang`.

This blocks button-smashing without disabling the control or hiding that a restart is required.

```mermaid
flowchart TD
  segmentClick[User clicks lang segment]
  playing{isPlaying?}
  sameLang{same as playingLang?}
  updateUI[Update selection + CTA only]
  confirm[window.confirm restart?]
  load[loadVideo once]
  revert[Revert segment to playingLang]

  segmentClick --> playing
  playing -->|no| updateUI
  playing -->|yes| sameLang
  sameLang -->|yes| updateUI
  sameLang -->|no| confirm
  confirm -->|OK| load
  confirm -->|Cancel| revert
```

### Implementation summary

1. **`playingLang`** — set when `loadVideo()` succeeds (episode cards only); separate from selected segment (`currentLang`).
2. **Segment clicks** — never auto-reload while playing; `handleLangSegmentClick()` handles confirm flow.
3. **Confirm copy** (`RESTART_CONFIRM_MESSAGES`) — target language’s message: EN / ES / HI (e.g. “Switch to English? The video will restart.”). Native `window.confirm()` is blocking, so only one dialog at a time.
4. **Documentary** (`video-quote-block`) — unchanged (no language segments on that block).
5. **Analytics** — no change; Plausible still fires on Watch/play with active `.lang-segment`; user must confirm before a mid-play restart.

### Out of scope (later)

- Custom modal instead of `window.confirm` (better a11y/branding).
- Vimeo Player API track switch without iframe teardown (if moving to one multi-track asset).
- Applying language on “next play” without confirm.

### Verification checklist

- Play episode in EN → switch to ES → Cancel → still EN audio, EN segment active.
- Play EN → switch ES → OK → one reload, ES plays.
- Rapid EN/ES/HI clicks while playing → at most one confirm at a time; no iframe storm without confirmations.
- Switch segment before play → no confirm; first play uses selected language.
- Legacy `.toggle-label` markup behaves the same (shared segment handler).

**Files created or modified:**

- `app/public/wp-content/plugins/custom-blocks-for-be-bite-smart/src/video-toggle.js` — `playingLang`, `handleLangSegmentClick()`, `RESTART_CONFIRM_MESSAGES` (en/es/hi); removed auto-reload on segment click
- `app/public/wp-content/plugins/custom-blocks-for-be-bite-smart/build/video-toggle.js` — compiled output (`pnpm run build`)
- `app/public/wp-content/CHANGES.md` — this entry

**Patterns or conventions followed from the codebase:**

- Episode-only behavior; documentary (`video-quote-block`) unchanged
- Native `window.confirm` (blocking, prevents iframe storm without extra UI)

**Problems encountered and how they were fixed:**

- None

**TODOs:**

- Optional: branded modal instead of `window.confirm` for accessibility

**What the next logical step would be:**

- Manually verify on `/education`: play episode → switch language → Cancel keeps EN; OK restarts in chosen language

## 2026-05-29 — Episode videos: 3+ languages (segmented picker)

**What was built and why:** Episode cards were limited to a binary EN/ES toggle and `vimeoUrlEn` / `vimeoUrlEs` attributes. The site is adding a third language; episodes now use a scalable segmented language picker, JSON `data-videos` map, and shared language config (EN, ES, FR).

**Files created or modified:**

- `app/public/wp-content/plugins/custom-blocks-for-be-bite-smart/src/includes/site-lang.php` — `bitesmart_site_languages()`, `bitesmart_normalize_lang_code()`, episode `render_block` injects `data-videos`, `data-watch-labels`, `data-site-lang`; editor localize via `generate_block_asset_handle`
- `app/public/wp-content/plugins/custom-blocks-for-be-bite-smart/src/shared/languages.js` — shared language list and Vimeo/JSON helpers
- `app/public/wp-content/plugins/custom-blocks-for-be-bite-smart/src/episode-card/episode-helpers.js` — migrate legacy attrs, render language picker, save data attributes
- `app/public/wp-content/plugins/custom-blocks-for-be-bite-smart/src/episode-card/index.js` — `videosByLang`, segmented UI, block deprecation from `vimeoUrlEn`/`vimeoUrlEs`
- `app/public/wp-content/plugins/custom-blocks-for-be-bite-smart/src/episode-card/style.css` — `.episode-lang-picker` / `.lang-segment` styles (legacy toggle CSS retained)
- `app/public/wp-content/plugins/custom-blocks-for-be-bite-smart/src/video-toggle.js` — reads `data-videos`, defaults to site language, supports legacy toggle markup
- `app/public/wp-content/plugins/custom-blocks-for-be-bite-smart/build/*` — `pnpm run build`
- `app/public/wp-content/themes/twentytwentyfive-child/inc/analytics.php` — `getLang()` reads `.lang-segment.active`, French analytics suffix
- `app/public/wp-content/tests/analytics/helpers/plausible.js` — episode tests use lang segments; `episodeLangCode`, `french` mapping
- `app/public/wp-content/tests/analytics/events.spec.js` — loops all configured languages per episode
- `app/public/wp-content/CHANGES.md` — this entry

**Patterns or conventions followed from the codebase:**

- Static block + `render_block` runtime data (same as prior `data-site-lang` approach)
- PDF/download blocks still EN/ES-only; episodes use new segmented picker pattern
- Block `deprecated` + `migrate` for editor; `render_block` + JS legacy fallbacks for saved HTML

**Problems encountered and how they were fixed:**

- Binary toggle CSS (`50%` width, `.es` class) cannot scale to N languages — replaced with `--lang-count` / `--lang-index` on `.episode-lang-picker`
- Existing posts keep legacy HTML until re-saved; `video-toggle.js` still supports `.toggle-label` and `data-vimeo-en`/`es` via `resolveVideosForBlock()`

**TODOs:**

- Re-save episode blocks in the editor to output FR segment when French Vimeo URLs are added
- Extend pdf-toggle / download-card to same `bitesmart_site_languages()` list (out of scope for this change)

**What the next logical step would be:**

- Add French Vimeo URLs per episode in the block sidebar, re-save, and verify FR segment + `episodes-watched-french` in Plausible

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