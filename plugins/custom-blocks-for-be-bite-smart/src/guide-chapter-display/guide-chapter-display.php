<?php
/**
 * Shared rendering for ONE Guide Chapter — the single function every
 * front-end surface that shows a chapter calls into, so there's exactly one
 * place that knows what a chapter's markup looks like:
 *  - a Guide's own page (single-guide.php, not yet built)
 *  - a chapter's own page (single-guide_chapter.php, not yet built)
 *  - the pooled multi-Guide search page, via a not-yet-built
 *    render_guide_chapter_search_card() that will call
 *    bitesmart_render_guide_chapter_row() below, same as how
 *    render_episode_search_card() reuses custom/qa-entry's markup rather
 *    than inventing its own (episode-display.php)
 *
 * See [[be-bitesmart-guide-cpt-plan]] in memory for the full feature. Not
 * registered as a block (no block.json) — chapters are never manually
 * inserted via the block editor, they render automatically wherever their
 * Guide (or they themselves) are viewed, so there's no insertion point that
 * would need one.
 *
 * DELIBERATELY SIMPLER than Episode's video embed (episode-display.php +
 * video-toggle.js): no thumbnail/play-button/lazy-load dance, no live
 * in-player language switching via the Vimeo Player SDK. A chapter's video
 * is already hidden behind a collapsed <details> by default, so there's no
 * "don't load the iframe until clicked" problem to solve the way Episode's
 * always-visible embed has — a plain <iframe loading="lazy"> inside the
 * (collapsed-by-default) body is enough. This also sidesteps a real timing
 * problem Episode's approach would have hit here: video-toggle.js wires up
 * every ".video-episode-block" exactly once, at DOMContentLoaded — but a
 * chapter row can enter the DOM LATER, when the pooled search page's
 * Fuse.js swaps in newly-matched cards well after DOMContentLoaded (same
 * mechanism as [[be-bitesmart-search-status]]'s existing card list). A
 * plain <iframe> needs no JS to work regardless of when it's inserted;
 * format-toggle.js's own language-picker clicks are event-delegated (see
 * that file) for the same reason. The language PICKER markup is still
 * reused from bitesmart_render_lang_picker_html() (site-lang.php) for
 * visual consistency with Episode/video-quote, just driven by
 * format-toggle.js's own delegated handler instead of video-toggle.js.
 */

/**
 * A stable, human-readable HTML id for one chapter — e.g.
 * "bringing-baby-home-chapter-3". Same reasoning as
 * bitesmart_episode_anchor_id() (episode-display.php): built from the
 * PARENT GUIDE's slug + Chapter Number, not the chapter's title, since a
 * title can be edited later (typo fix, rewording) and would silently break
 * any external link/bookmark pointing at the old id. Guide slug (not
 * Guide title) for the same reason on that side too.
 *
 * @param WP_Post $chapter_post
 * @return string
 */
function bitesmart_guide_chapter_anchor_id( $chapter_post ) {
    $guide_id = (int) get_post_meta( $chapter_post->ID, '_bitesmart_chapter_guide_id', true );
    $guide    = $guide_id ? get_post( $guide_id ) : null;
    $guide_slug = ( $guide && 'guide' === $guide->post_type ) ? $guide->post_name : 'guide';

    $number = get_post_meta( $chapter_post->ID, '_bitesmart_chapter_number', true );
    if ( $number ) {
        return $guide_slug . '-chapter-' . sanitize_title( $number );
    }

    // No Chapter Number filled in — fall back to the chapter's own title
    // slug so the id is still unique/readable, even though (only in this
    // fallback case) it isn't stable against a future title edit.
    $title_slug = sanitize_title( get_the_title( $chapter_post ) );
    return $title_slug ? $guide_slug . '-' . $title_slug : $guide_slug . '-chapter-' . $chapter_post->ID;
}

/**
 * Lang code => Vimeo numeric ID map for one chapter, dropping any entry
 * that doesn't resolve to a real Vimeo ID. Thin wrapper around the same
 * helper Episode uses (site-lang.php) — kept as its own function so callers
 * don't need to know the underlying meta key.
 *
 * @param int $chapter_id
 * @return array<string, string>
 */
function bitesmart_guide_chapter_video_ids( $chapter_id ) {
    $videos = get_post_meta( $chapter_id, '_bitesmart_chapter_videos_by_lang', true );
    return bitesmart_vimeo_ids_by_lang_map( is_array( $videos ) ? $videos : array() );
}

/**
 * Lang code => downloadable PDF URL map for one chapter, empty entries
 * already dropped by bitesmart_sanitize_guide_chapter_pdfs_by_lang()
 * (guide-chapter-cpt.php) at save time — this just reads the meta back and
 * guards against a non-array value (e.g. a chapter created before this meta
 * field existed, where get_post_meta() falls back to its registered
 * default, an empty array, so this guard is mostly defensive).
 *
 * @param int $chapter_id
 * @return array<string, string>
 */
function bitesmart_guide_chapter_pdf_urls( $chapter_id ) {
    $pdfs = get_post_meta( $chapter_id, '_bitesmart_chapter_pdf_by_lang', true );
    return is_array( $pdfs ) ? $pdfs : array();
}

/**
 * Short display label for a language code (e.g. "en" => "EN", "es" => "ES")
 * — same {code => label} lookup bitesmart_site_languages() already builds
 * for the video language picker/segmented control, just without needing a
 * whole picker for a plain Download link's button text. Falls back to the
 * uppercased code itself if the language isn't in the site's configured
 * list for some reason (defensive; shouldn't normally happen since the
 * editor UI only ever writes codes from that same list).
 *
 * @param string $code Short language code, e.g. 'en'.
 * @return string
 */
function bitesmart_guide_chapter_lang_label( $code ) {
    $labels = wp_list_pluck( bitesmart_site_languages(), 'label', 'code' );
    return isset( $labels[ $code ] ) ? $labels[ $code ] : strtoupper( $code );
}

/**
 * Renders ONE chapter as a native <details> row — badges always visible,
 * expand to reveal video and/or text (each independently hideable by the
 * page-level format-toggle checkboxes — see format-toggle.js), plus, at the
 * bottom of the expanded body (2026-08-16), a Download PDF button per
 * language that has one uploaded (see bitesmart_guide_chapter_pdf_urls()
 * above) — always shown regardless of the video/text toggle state, not
 * part of that system at all. No JS needed for the expand/collapse itself:
 * same native <details>/<summary> idiom as custom/qa-entry
 * (qa-entry-display.php) and Episode's search card — deliberate, since it
 * works identically whether the row was in the page's initial HTML or
 * injected later by the pooled search page's Fuse.js swap (see this file's
 * header comment).
 *
 * @param int $chapter_id
 * @param array{accordion_group?: string, show_guide_link?: bool, show_chapter_link?: bool} $args
 *     accordion_group: if set, this <details> gets a matching `name`
 *         attribute, making it part of an HTML native exclusive-accordion
 *         group (opening one auto-closes the others sharing the same
 *         name) — used for "one chapter open at a time" on a single
 *         Guide's own page. Left unset (the default) on the pooled
 *         multi-Guide search page, where chapters from different Guides
 *         being independently open at once is the more useful behavior.
 *     show_guide_link: whether to show a "Part of: {Guide title}" backlink
 *         in the expanded body — true by default; a Guide's own page
 *         passes false for its own chapters, since the backlink would be
 *         redundant there.
 *     show_chapter_link: whether to show a "View full chapter page" link
 *         (this chapter's own real permalink — see guide-chapter-cpt.php)
 *         in the expanded body, right after the "Part of" backlink — true
 *         by default, since every other surface a chapter renders in
 *         (Guide's own page, pooled/Stage search results) had NO way to
 *         reach a chapter's standalone page at all before 2026-08-16, even
 *         though it's always existed. A chapter's own single page (see
 *         guide-single.php) passes false — a link to the exact page
 *         already being viewed is redundant, same reasoning as
 *         show_guide_link's own false case above.
 *     open: pre-expand this chapter's <details> — false by default; a
 *         chapter's own single page passes true (see guide-single.php).
 * @return string HTML, or '' if the chapter/its parent Guide doesn't
 *     resolve to something publishable.
 */
function bitesmart_render_guide_chapter_row( $chapter_id, array $args = array() ) {
    $post = $chapter_id ? get_post( $chapter_id ) : null;
    if ( ! $post || 'guide_chapter' !== $post->post_type || 'publish' !== $post->post_status ) {
        return '';
    }

    $args = wp_parse_args( $args, array(
        'accordion_group'   => '',
        'show_guide_link'   => true,
        'show_chapter_link' => true,
        'open'              => false, // pre-expanded — a chapter's own single page passes true, since there's nothing else on that page competing for attention.
    ) );

    $guide_id = (int) get_post_meta( $chapter_id, '_bitesmart_chapter_guide_id', true );
    $guide    = $guide_id ? get_post( $guide_id ) : null;
    $guide_ok = ( $guide && 'guide' === $guide->post_type && 'publish' === $guide->post_status );

    $number      = get_post_meta( $chapter_id, '_bitesmart_chapter_number', true );
    $summary     = get_post_meta( $chapter_id, '_bitesmart_chapter_summary', true );
    $has_text    = (bool) get_post_meta( $chapter_id, '_bitesmart_chapter_has_text', true );
    $duration    = get_post_meta( $chapter_id, '_bitesmart_chapter_video_duration', true );
    $video_ids   = bitesmart_guide_chapter_video_ids( $chapter_id );
    $has_video   = ! empty( $video_ids );
    $pdf_urls    = bitesmart_guide_chapter_pdf_urls( $chapter_id );
    $site_lang   = bitesmart_site_lang_code();
    $anchor_id   = bitesmart_guide_chapter_anchor_id( $post );

    $default_lang = isset( $video_ids[ $site_lang ] ) ? $site_lang : ( array_key_first( $video_ids ) ?: 'en' );
    $default_video_id = $video_ids[ $default_lang ] ?? '';

    ob_start();
    ?>
    <article class="wp-block-guide-chapter guide-chapter-row" data-chapter-id="<?php echo esc_attr( $chapter_id ); ?>">
        <details
            id="<?php echo esc_attr( $anchor_id ); ?>"
            class="guide-chapter-container custom-block-card custom-block-border"
            <?php if ( $args['accordion_group'] ) : ?>
                name="<?php echo esc_attr( $args['accordion_group'] ); ?>"
            <?php endif; ?>
            <?php if ( $args['open'] ) : ?>
                open
            <?php endif; ?>
        >
            <summary class="guide-chapter-summary">
                <?php if ( $number ) : ?>
                    <span class="guide-chapter-index"><?php echo esc_html( $number ); ?></span>
                <?php endif; ?>
                <span class="guide-chapter-main">
                    <span class="guide-chapter-title-row">
                        <span class="guide-chapter-title"><?php echo esc_html( get_the_title( $post ) ); ?></span>
                        <span class="guide-chapter-badges">
                            <?php
                            // Real <button>s, not <span>s — they're independently
                            // clickable toggles now (format-toggle.js), not just status
                            // indicators. A click has to call preventDefault() to stop
                            // the browser's native "toggle the enclosing <details>"
                            // behavior, which normally fires for ANY click landing
                            // inside a <summary>, buttons included — see
                            // handleBadgeClick() in format-toggle.js.
                            //
                            // Two independent layers of visibility, both true by
                            // default: bitesmart_render_guide_format_controls()'s
                            // checkboxes turn a format off EVERYWHERE (all chapters at
                            // once); this button turns it off/on for just THIS chapter
                            // — see applyFormatState() in format-toggle.js for how the
                            // two combine (both have to be "on" for the format to
                            // actually show for a given chapter).
                            //
                            // Only real toggle buttons when the chapter actually HAS
                            // that format — aria-pressed="true" starting state, class
                            // is-active (existing "has it" styling doubles as "on").
                            // When the chapter has NO video/text at all, disabled: there
                            // is nothing to toggle, so it stays non-interactive (keeps
                            // the existing is-inactive "doesn't have this" look, visually
                            // distinct from is-off below, which means "has it, currently
                            // hidden for this chapter").
                            ?>
                            <button
                                type="button"
                                class="guide-chapter-badge<?php echo $has_video ? ' is-active' : ' is-inactive'; ?>"
                                data-format="video"
                                <?php echo $has_video ? 'aria-pressed="true"' : 'disabled'; ?>
                            >
                                <?php esc_html_e( 'Video', 'custom-blocks' ); ?>
                            </button>
                            <button
                                type="button"
                                class="guide-chapter-badge<?php echo $has_text ? ' is-active' : ' is-inactive'; ?>"
                                data-format="text"
                                <?php echo $has_text ? 'aria-pressed="true"' : 'disabled'; ?>
                            >
                                <?php esc_html_e( 'Text', 'custom-blocks' ); ?>
                            </button>
                        </span>
                    </span>
                    <?php if ( $summary ) : ?>
                        <span class="guide-chapter-summary-text"><?php echo esc_html( $summary ); ?></span>
                    <?php endif; ?>
                </span>
                <svg class="guide-chapter-chevron" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">
                    <polyline points="5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>
                </svg>
            </summary>

            <div class="guide-chapter-body">

                <?php if ( $has_video ) : ?>
                    <div class="guide-chapter-format guide-chapter-video" data-format="video">
                        <?php if ( count( $video_ids ) > 1 ) : ?>
                            <?php echo bitesmart_render_lang_picker_html( array_keys( $video_ids ), $default_lang ); ?>
                        <?php endif; ?>
                        <?php if ( $duration ) : ?>
                            <p class="guide-chapter-video-duration"><?php echo esc_html( $duration ); ?></p>
                        <?php endif; ?>
                        <div class="guide-chapter-video-frame" data-videos="<?php echo esc_attr( wp_json_encode( $video_ids ) ); ?>">
                            <iframe
                                src="https://player.vimeo.com/video/<?php echo esc_attr( $default_video_id ); ?>?title=0&amp;byline=0&amp;portrait=0"
                                loading="lazy"
                                allow="autoplay; fullscreen; picture-in-picture"
                                allowfullscreen
                                title="<?php echo esc_attr( get_the_title( $post ) ); ?>"
                            ></iframe>
                        </div>
                    </div>
                <?php else : ?>
                    <p class="guide-chapter-format guide-chapter-missing-note" data-format="video">
                        <?php esc_html_e( 'No video for this chapter yet.', 'custom-blocks' ); ?>
                    </p>
                <?php endif; ?>

                <?php if ( $has_text ) : ?>
                    <div class="guide-chapter-format guide-chapter-text" data-format="text">
                        <?php
                        // do_blocks(), NOT apply_filters('the_content', ...) — this
                        // function gets called FROM inside 'the_content' itself on a
                        // chapter's own single page (see guide-single.php), and
                        // 'the_content' is a filter, not a one-shot function: calling
                        // it again here would re-trigger every OTHER callback hooked
                        // to it too, including this plugin's own singular-guide_chapter
                        // replacement, an infinite loop. do_blocks() runs just the
                        // actual Gutenberg block-parsing/rendering step, which is all
                        // real block-editor-authored content (this chapter's body)
                        // needs — no wpautop/wptexturize/shortcode passes to worry
                        // about skipping, since block markup already emits real HTML.
                        echo do_blocks( $post->post_content );
                        ?>
                    </div>
                <?php else : ?>
                    <p class="guide-chapter-format guide-chapter-missing-note" data-format="text">
                        <?php esc_html_e( 'No text version for this chapter yet.', 'custom-blocks' ); ?>
                    </p>
                <?php endif; ?>

                <?php if ( ! empty( $pdf_urls ) ) : ?>
                    <?php
                    // Deliberately NOT a .guide-chapter-format[data-format="..."]
                    // element — that class/attribute pair is specifically what
                    // format-toggle.js's applyFormatState() reads to show/hide
                    // video/text per the "Show:" checkboxes above (see that
                    // file), and a downloadable PDF isn't part of that video/
                    // text toggle system at all: it's an always-available extra,
                    // independent of whichever formats a visitor currently has
                    // shown. One button per language that actually has a PDF —
                    // same plain-Download-link idiom (no inline viewer/toggle)
                    // as render_coloring_book_search_card()'s Download buttons
                    // (coloring-book-display.php), since a search/browse
                    // context is the wrong place for an inline PDF iframe, and
                    // this same row renders in exactly that context too (see
                    // render_guide_chapter_search_card() below).
                    ?>
                    <div class="guide-chapter-downloads">
                        <p class="guide-chapter-downloads-label"><?php esc_html_e( 'Download this chapter:', 'custom-blocks' ); ?></p>
                        <div class="guide-chapter-download-buttons">
                            <?php foreach ( $pdf_urls as $lang_code => $pdf_url ) : ?>
                                <?php
                                // Same three classes every other Download link on the site
                                // uses — block-toggle-btn/is-style-outline give the shared
                                // blue "download button" look (theme's style.css), and
                                // download-card-pdf-download is what wires this into the
                                // theme's existing Plausible download-click tracking
                                // (twentytwentyfive-child/inc/analytics.php) for free, same
                                // as bitesmart_coloring_book_language_row()'s Download links
                                // (coloring-book-display.php) and pdf-toggle/index.js.
                                ?>
                                <a
                                    href="<?php echo esc_url( $pdf_url ); ?>"
                                    download
                                    class="block-toggle-btn is-style-outline download-card-pdf-download"
                                    data-lang="<?php echo esc_attr( $lang_code ); ?>"
                                >
                                    <?php
                                    printf(
                                        /* translators: %s: short language label, e.g. "EN" */
                                        esc_html__( 'Download PDF (%s)', 'custom-blocks' ),
                                        esc_html( bitesmart_guide_chapter_lang_label( $lang_code ) )
                                    );
                                    ?>
                                </a>
                            <?php endforeach; ?>
                        </div>
                    </div>
                <?php endif; ?>

                <?php if ( $args['show_guide_link'] && $guide_ok ) : ?>
                    <p class="guide-chapter-parent-link">
                        <?php esc_html_e( 'Part of:', 'custom-blocks' ); ?>
                        <?php
                        // Hardcoded to /learning/guide/ rather than get_permalink($guide)
                        // — Guide is headless now (guide-cpt.php), so it has no permalink
                        // of its own; its one real front end is wherever an editor placed
                        // custom/guide-single (see guide-single.php), which Janet actually
                        // created at /learning/guide/ (nested under the existing Learning
                        // Hub, not a site-root /guide/ Page as originally planned — see
                        // [[be-bitesmart-guide-cpt-plan]] in memory). Same "one known
                        // destination" idiom as Episode's hardcoded /learning/kids/ link
                        // (episode-display.php's render_episode_search_card()).
                        // guide_chapter's OWN permalink prefix was ALSO moved to nest
                        // under this same /learning/guide/ path as of 2026-08-16 (see
                        // guide-chapter-cpt.php) — the two are still independently
                        // maintained values (this link isn't derived from that rewrite
                        // slug or vice versa), they just happen to agree on purpose now.
                        ?>
                        <a href="<?php echo esc_url( home_url( '/learning/guide/' ) ); ?>"><?php echo esc_html( get_the_title( $guide ) ); ?></a>
                    </p>
                <?php endif; ?>

                <?php if ( $args['show_chapter_link'] ) : ?>
                    <?php
                    // This chapter's own real permalink (/learning/guide/<slug>/
                    // — see guide-chapter-cpt.php), surfaced here 2026-08-16: before
                    // this, a chapter always rendered inline wherever it
                    // appeared (Guide's own page, pooled/Stage search results)
                    // with no way to reach its standalone, individually
                    // shareable page — Janet: "theres no way someone on the
                    // guide can get to the individual chapter pages." Plain
                    // get_permalink() works fine here — unlike Guide,
                    // guide_chapter has a real rewrite rule.
                    ?>
                    <p class="guide-chapter-own-link">
                        <a href="<?php echo esc_url( get_permalink( $chapter_id ) ); ?>">
                            <?php esc_html_e( 'View full chapter page', 'custom-blocks' ); ?>
                        </a>
                    </p>
                <?php endif; ?>

            </div>
        </details>
    </article>
    <?php
    return ob_get_clean();
}

/**
 * Renders one chapter for the Learning Hub Search/Browse blocks
 * (custom/learning-search and custom/learning-browse — two SEPARATE blocks
 * as of 2026-08-16, each independently calling
 * bitesmart_build_stage_card_list() for the same Stage, see that
 * function's own comment in learning-search.php) — alongside
 * render_qa_entry_block()/render_resource_block()/render_episode_search_card()/
 * render_coloring_book_search_card() for the other content types shown
 * there.
 *
 * UNLIKE those, this is NOT a compact teaser — it's the exact SAME full
 * accordion row bitesmart_render_guide_chapter_row() renders everywhere
 * else (video, text, badges, all of it). Deliberate, per Janet: search
 * results here should let a visitor actually view the chapter in place,
 * not link out to read it elsewhere — see [[be-bitesmart-guide-cpt-plan]]
 * in memory, "Front end: one pooled, searchable accordion — not link-out
 * cards". No `accordion_group` — chapters appearing in a mixed search/
 * browse list (possibly from different Guides once a second Guide post
 * type exists) should be independently openable, not forced into a single
 * "one at a time" group the way a single Guide's own page uses.
 *
 * @param array $attributes Block-style attributes ({ chapterId }), matching
 *     the shape every other *_search_card() function in this codebase uses.
 * @return string
 */
function render_guide_chapter_search_card( $attributes ) {
    $chapter_id = isset( $attributes['chapterId'] ) ? (int) $attributes['chapterId'] : 0;

    return bitesmart_render_guide_chapter_row( $chapter_id, array(
        'show_guide_link' => true,
    ) );
}

/**
 * The shared "Show video" / "Show text" checkbox bar + zero-formats-picked
 * warning — rendered once per BLOCK that needs it (never per chapter), read
 * by format-toggle.js. Only rendered where the surrounding content is 100%
 * chapters: the main Guide page/chapter page (guide-single.php, always) and
 * the pooled Guide search+browse pages (stage_slug === 'guide', in
 * learning-search.php / learning-browse.php). Deliberately NOT rendered on
 * real Stage pages, where chapters are at most a small slice of a mixed
 * Q&A/Resource/Episode list and a global control would apply to almost
 * nothing on screen — those pages rely solely on each chapter's own
 * per-chapter badges instead. Because custom/learning-search and
 * custom/learning-browse are separate blocks that could both legitimately
 * sit on the pooled Guide page at once, up to two copies can still render
 * on one page — format-toggle.js already treats every `.guide-format-checkbox`
 * on the page as one synchronized group regardless of how many copies
 * exist, so that's a deliberate, accepted redundancy, not a bug. Both
 * checked by default, preference persisted per-browser via localStorage (no
 * accounts on this site — see [[be-bitesmart-guide-cpt-plan]] in memory) —
 * the actual default/restore logic lives client-side in format-toggle.js;
 * this just emits the checked="checked" starting markup so the controls
 * render correctly before JS runs (progressive enhancement: with JS
 * disabled, every chapter's video AND text both show, matching these
 * boxes' server-rendered checked state).
 *
 * @return string
 */
function bitesmart_render_guide_format_controls() {
    ob_start();
    ?>
    <div class="guide-format-controls">
        <span class="guide-format-controls-label"><?php esc_html_e( 'Show:', 'custom-blocks' ); ?></span>
        <label class="guide-format-toggle">
            <input type="checkbox" class="guide-format-checkbox" data-format="video" checked>
            <?php esc_html_e( 'Video', 'custom-blocks' ); ?>
        </label>
        <label class="guide-format-toggle">
            <input type="checkbox" class="guide-format-checkbox" data-format="text" checked>
            <?php esc_html_e( 'Text', 'custom-blocks' ); ?>
        </label>
        <p class="guide-format-warning" role="status" hidden>
            <?php esc_html_e( 'Turn on video or text above to see chapter content.', 'custom-blocks' ); ?>
        </p>
    </div>
    <?php
    return ob_get_clean();
}

/**
 * Enqueues format-toggle.js + its style.css wherever a chapter row (or the
 * format controls bar) can actually appear. NOT a registered block, so it
 * can't rely on WordPress's automatic "saved content contains this block"
 * detection (has_block()) the way most blocks in this plugin do for their
 * OWN markup — but the block surfaces here DO place real blocks
 * (custom/guide-single, wherever an editor put the main Guide Page;
 * custom/learning-search AND custom/learning-browse, split 2026-08-16 —
 * either can independently render a format-controls bar/chapter rows for
 * the same Stage, see each block's own render callback), so has_block()
 * works for all three. The remaining surface (a chapter's own single-post
 * page) is a real template view, not block content at all — is_singular()
 * is the right check there. Guide itself is headless now (no permalink —
 * see guide-cpt.php), so there's no is_singular('guide') branch; its only
 * front end is the custom/guide-single block, already covered.
 *
 * Same webpack entry/asset.php/style-index.css pattern as pdf-toggle (see
 * that block's own manual enqueue in the main plugin file) — this file
 * isn't a block.json-registered block, so nothing enqueues it automatically.
 */
function bitesmart_enqueue_guide_chapter_display_assets() {
    $needs_assets = is_singular( 'guide_chapter' )
        || has_block( 'custom/learning-search' )
        || has_block( 'custom/learning-browse' )
        || has_block( 'custom/guide-single' );

    if ( ! $needs_assets ) {
        return;
    }

    // __FILE__ resolves to src/guide-chapter-display/guide-chapter-display.php
    // — same dirname(dirname(__FILE__)) + plugins_url()/plugin_dir_path()
    // idiom as src/qr-experience/render.php and
    // src/guide-chapter-panel/guide-chapter-panel.php (see either of those
    // files' comments for the full "why not plugin_dir_url(__FILE__)"
    // reasoning: webpack compiles this script into build/, not src/).
    $plugin_root = dirname( dirname( __FILE__ ) );

    $asset_file = plugin_dir_path( $plugin_root ) . 'build/guide-chapter-display/format-toggle.asset.php';
    if ( ! file_exists( $asset_file ) ) {
        return;
    }
    $asset = include $asset_file;

    wp_enqueue_script(
        'guide-format-toggle',
        plugins_url( 'build/guide-chapter-display/format-toggle.js', $plugin_root ),
        $asset['dependencies'],
        $asset['version'],
        true
    );

    $style_path = plugin_dir_path( $plugin_root ) . 'build/guide-chapter-display/style-format-toggle.css';
    if ( file_exists( $style_path ) ) {
        wp_enqueue_style(
            'guide-format-toggle',
            plugins_url( 'build/guide-chapter-display/style-format-toggle.css', $plugin_root ),
            array(),
            filemtime( $style_path )
        );
    }
}
add_action( 'wp_enqueue_scripts', 'bitesmart_enqueue_guide_chapter_display_assets' );
