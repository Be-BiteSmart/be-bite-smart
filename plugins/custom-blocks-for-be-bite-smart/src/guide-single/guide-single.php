<?php
/**
 * Front end for the Guide feature — both reuse
 * bitesmart_render_guide_single()/bitesmart_render_guide_chapter_single()
 * below, so there's exactly one place that assembles "a Guide's full
 * accordion page":
 *
 * 1. `custom/guide-single` — a CPT-backed display block (save() => null,
 *    render_callback below does all the work). UNLIKE custom/episode/
 *    custom/qa-entry/custom/resource, no attributes/picker at all as of
 *    2026-08-16 (see block.json and render_guide_single_block()'s own
 *    comment) — it resolves the site's one Guide itself
 *    (bitesmart_get_the_main_guide(), guide-cpt.php), per Janet: "we only
 *    ever have the one guide, so this dropdown is unnecessary." This is
 *    THE way to reach the Guide's content — Janet's call: the site
 *    effectively has ONE Guide (a genuinely different second guide would
 *    get its own separate post type, not a second post here — see
 *    guide-cpt.php), so it doesn't
 *    need its own permalink; a normal WP Page with this block placed on it
 *    gives a clean URL using WordPress's existing Page-permalink system, no
 *    custom rewrite rules needed. Originally planned as a site-root Page
 *    (slug exactly "guide", giving `/guide/`) — Janet actually created it
 *    nested under the existing Learning Hub instead, at `/learning/guide/`
 *    (see the hardcoded backlink in guide-chapter-display.php's
 *    bitesmart_render_guide_chapter_row(), and
 *    [[be-bitesmart-guide-cpt-plan]] in memory). Guide itself is headless
 *    (`guide-cpt.php`) — this block is its ONLY front end.
 *
 * 2. Guide Chapter's OWN real permalink (`/learning/guide/<chapter-slug>/`
 *    as of 2026-08-16, moved to nest under this same `/learning/guide/`
 *    path once that's where custom/guide-single itself actually ended up
 *    living — see guide-chapter-cpt.php for the full "why" and why nesting
 *    a CPT one level under a real, non-headless Page's own URL is still
 *    safe). The child theme
 *    (twentytwentyfive-child) has no templates/ directory of its own — it's
 *    a pure block theme relying entirely on parent Twenty Twenty-Five's
 *    block templates (see [[be-bitesmart-plugin-architecture]]), and a
 *    single chapter isn't worth a whole new `templates/single-guide_chapter.html`
 *    just to swap out the middle. Simpler: WordPress's core Post Content
 *    block already renders a singular post's content by internally calling
 *    `apply_filters('the_content', ...)` — same as a classic theme's
 *    `the_content()` call — so hooking that ONE filter, guarded to only
 *    replace the OUTERMOST/main-query call (`is_main_query() &&
 *    in_the_loop()`), swaps in this plugin's own markup without touching
 *    any theme files at all.
 *
 * Either way, bitesmart_render_guide_chapter_row()'s own text rendering
 * uses do_blocks() rather than apply_filters('the_content', ...)
 * internally — see that function's comment (guide-chapter-display.php) for
 * why calling the SAME filter #2 hooks would recurse.
 */

/**
 * A Guide's own page: the format-toggle controls, then every one of its
 * chapters as a native-accordion list (see
 * bitesmart_render_guide_chapter_row()'s `accordion_group` — every chapter
 * here shares one group, so opening one auto-closes the others, matching
 * Janet's "accordion is friendliest" call). Ordered by Chapter Number,
 * cast numeric so "2" sorts before "10" (a chapter left with no number at
 * all still appears, just wherever a numeric cast of '' happens to sort —
 * editors are encouraged, not required, to fill it in).
 *
 * A `<h2 class="guide-section-heading">` is inserted between chapters
 * whenever the chapter's Guide Section term (guide-section-taxonomy.php)
 * changes from the previous chapter's — added 2026-08-16, see this
 * function's own inline comment at the loop for the full "why" and how
 * section ORDER falls naturally out of the existing Chapter Number
 * ordering with no extra data needed.
 *
 * The Guide-stage Learning Hub Search renders the collapsible Table of
 * Contents immediately before its search controls. The underlying chapter
 * query is still shared through bitesmart_get_guide_chapters_with_sections()
 * (guide-chapter-display.php), backed by a persistent cache.
 *
 * Does NOT render the Guide's Description — that used to render here (a
 * plain paragraph, right above the chapter list) but was split out into
 * its own block, `custom/guide-description` (see guide-description.php),
 * 2026-08-16 per Janet: "lets get rid of the summary from under view all
 * chapters since it should be at the top of the guide page instead. Is
 * there a way I can grab the summary and put it where I want it on the
 * page?" She now places that block independently, anywhere on the same
 * Page as this one — both pull the same `_bitesmart_guide_description`
 * meta live, so editing it once in the Guide's own edit screen updates
 * every placement.
 *
 * @param int $guide_id
 * @return string HTML, or '' if $guide_id isn't a real Guide post.
 */
function bitesmart_render_guide_single( $guide_id ) {
    $post = get_post( $guide_id );
    if ( ! $post || 'guide' !== $post->post_type ) {
        return '';
    }

    $chapters_with_sections = bitesmart_get_guide_chapters_with_sections( $guide_id );
    $accordion_group        = 'guide-' . $guide_id;

    ob_start();
    ?>
    <div class="guide-single">
        <?php if ( $chapters_with_sections ) : ?>
            <?php
            // NOT rendering bitesmart_render_guide_format_controls() here as
            // of 2026-08-28 (was, always, before that) — Janet confirmed this
            // block is placed on the SAME page as the pooled Guide-stage
            // custom/learning-search block (stage_slug === 'guide'), which
            // renders its own copy of this exact bar; that sibling copy is
            // enough, same "one filter is enough" call as
            // custom/learning-browse's now-dropped "Filter by type" copy
            // (see learning-browse.php). See
            // bitesmart_render_guide_format_controls()'s own docblock
            // (guide-chapter-display.php) for the full up-to-date picture of
            // where this bar renders.
            ?>
            <?php
            $current_section = null;
            $chapter_rows    = '';

            foreach ( $chapters_with_sections as $entry ) :
                $chapter_id   = $entry['chapter_id'];
                $section_name = $entry['section'];

                // bitesmart_get_guide_chapters_with_sections() may be
                // serving a cached list of ids — get_post() re-resolves
                // each one fresh (cheap: hits WordPress's own object cache
                // in the common case). A chapter trashed/deleted since the
                // cache was built (rare — the cache is invalidated on
                // save/delete/Section-term-change, see that function's own
                // comment) simply won't resolve here; skip it rather than
                // render a broken row.
                $chapter = get_post( $chapter_id );
                if ( ! $chapter ) :
                    continue;
                endif;

                if ( $section_name !== $current_section ) :
                    $current_section = $section_name;
                    if ( $section_name ) :
                        // id = sanitize_title() of the Section name — matches
                        // the guide_section term's own slug exactly (verified:
                        // every existing term's slug already equals
                        // sanitize_title($name)), so the Learning Hub Menu's
                        // "Parent Guide" dropdown can link straight to
                        // /learning/guide#<this-id> without needing the term
                        // object itself here.
                        $section_anchor = sanitize_title( $section_name );
                        $chapter_rows  .= '<h2 class="guide-section-heading" id="' . esc_attr( $section_anchor ) . '">' . esc_html( $section_name ) . '</h2>';
                    endif;
                endif;

                $chapter_rows .= bitesmart_render_guide_chapter_row( $chapter_id, array(
                    'accordion_group' => $accordion_group,
                    'show_guide_link' => false, // redundant — we're already ON this chapter's guide
                ) );
            endforeach;
            ?>

            <div class="guide-chapter-list">
                <?php echo $chapter_rows; // phpcs:ignore ?>
            </div>
        <?php else : ?>
            <p class="guide-single-empty"><?php esc_html_e( 'Chapters for this guide are coming soon.', 'custom-blocks' ); ?></p>
        <?php endif; ?>
    </div>
    <?php
    return ob_get_clean();
}

/**
 * Previous/next links for a standalone Guide Chapter page.
 *
 * @param WP_Post|null $previous Previous published chapter.
 * @param WP_Post|null $next Next published chapter.
 * @return string
 */
function bitesmart_render_guide_chapter_navigation( $previous, $next ) {
    if ( ! $previous && ! $next ) {
        return '';
    }

    ob_start();
    ?>
    <nav class="guide-chapter-navigation guide-chapter-breadcrumb" aria-label="<?php esc_attr_e( 'Chapter navigation', 'custom-blocks' ); ?>">
        <?php if ( $previous ) : ?>
            <a class="guide-chapter-navigation-previous" href="<?php echo esc_url( get_permalink( $previous ) ); ?>">
                <?php
                printf(
                    /* translators: %s: previous chapter title */
                    esc_html__( '← Previous: %s', 'custom-blocks' ),
                    esc_html( get_the_title( $previous ) )
                );
                ?>
            </a>
        <?php endif; ?>
        <?php if ( $next ) : ?>
            <a class="guide-chapter-navigation-next" href="<?php echo esc_url( get_permalink( $next ) ); ?>">
                <?php
                printf(
                    /* translators: %s: next chapter title */
                    esc_html__( 'Next: %s →', 'custom-blocks' ),
                    esc_html( get_the_title( $next ) )
                );
                ?>
            </a>
        <?php endif; ?>
    </nav>
    <?php
    return ob_get_clean();
}

/**
 * A chapter's own page: breadcrumb back to the Guide, a section/chapter
 * label, the chapter heading, navigation, then the chapter content without
 * a collapsible wrapper.
 *
 * @param int $chapter_id
 * @return string HTML, or '' if $chapter_id isn't a real published chapter.
 */
function bitesmart_render_guide_chapter_single( $chapter_id ) {
    $post = get_post( $chapter_id );
    if ( ! $post || 'guide_chapter' !== $post->post_type ) {
        return '';
    }

    // The chapter list helper provides the published chapter sequence for
    // this Guide, ordered by chapter number and grouped by the current
    // Guide relationship.
    $guide           = bitesmart_guide_chapter_parent_guide( $chapter_id );
    $previous_chapter = null;
    $next_chapter     = null;
    if ( $guide ) {
        $chapter_entries = bitesmart_get_guide_chapters_with_sections( $guide->ID );
        foreach ( $chapter_entries as $index => $entry ) {
            if ( (int) $entry['chapter_id'] !== (int) $chapter_id ) {
                continue;
            }

            foreach ( array( 'previous' => $index - 1, 'next' => $index + 1 ) as $direction => $neighbor_index ) {
                if ( ! isset( $chapter_entries[ $neighbor_index ] ) ) {
                    continue;
                }

                $neighbor = get_post( $chapter_entries[ $neighbor_index ]['chapter_id'] );
                if ( ! $neighbor || 'guide_chapter' !== $neighbor->post_type || 'publish' !== $neighbor->post_status ) {
                    continue;
                }

                if ( 'previous' === $direction ) {
                    $previous_chapter = $neighbor;
                } else {
                    $next_chapter = $neighbor;
                }
            }
            break;
        }
    }
    $chapter_navigation = bitesmart_render_guide_chapter_navigation( $previous_chapter, $next_chapter );

    // The breadcrumb is the top-of-page counterpart to the chapter row's
    // "Part of" link. Only rendered when the parent Guide resolves.
    $number        = get_post_meta( $chapter_id, '_bitesmart_chapter_number', true );
    $section_terms = get_the_terms( $chapter_id, 'guide_section' );
    $section_name  = ( ! is_wp_error( $section_terms ) && ! empty( $section_terms ) ) ? $section_terms[0]->name : '';
    $section_label = '';
    if ( $section_name && preg_match( '/^(Section\s+\S+)/u', $section_name, $matches ) ) {
        $section_label = $matches[1];
    }

    ob_start();
    ?>
    <div class="guide-chapter-single">
        <?php if ( $guide ) : ?>
            <nav class="guide-chapter-breadcrumb" aria-label="<?php esc_attr_e( 'Breadcrumb', 'custom-blocks' ); ?>">
                <?php
                // Hardcoded to /learning/guide/ — same "one known
                // destination" idiom as bitesmart_render_guide_chapter_row()'s
                // own "Part of" link (guide-chapter-display.php); Guide is
                // headless, so get_permalink($guide) isn't an option.
                ?>
                <a href="<?php echo esc_url( home_url( '/learning/guide/' ) ); ?>">
                    <?php
                    printf(
                        /* translators: %s: Guide title */
                        esc_html__( '‹ Back to %s', 'custom-blocks' ),
                        esc_html( get_the_title( $guide ) )
                    );
                    ?>
                </a>
            </nav>
        <?php endif; ?>

        <?php if ( $section_label || $number ) : ?>
            <p class="guide-chapter-position">
                <?php
                if ( $section_label && $number ) {
                    printf(
                        /* translators: 1: section number, 2: chapter number */
                        esc_html__( '%1$s - Chapter %2$s', 'custom-blocks' ),
                        esc_html( $section_label ),
                        esc_html( $number )
                    );
                } elseif ( $number ) {
                    printf(
                        /* translators: %s: chapter number */
                        esc_html__( 'Chapter %s', 'custom-blocks' ),
                        esc_html( $number )
                    );
                } else {
                    echo esc_html( $section_label );
                }
                ?>
            </p>
        <?php endif; ?>

        <h1 class="guide-chapter-heading"><?php echo esc_html( get_the_title( $post ) ); ?></h1>

        <?php echo $chapter_navigation; // phpcs:ignore ?>

        <?php
        echo bitesmart_render_guide_chapter_row( $chapter_id, array( // phpcs:ignore
            'show_guide_link'   => true,
            // Redundant here — a "View full chapter page" link to the exact
            // page already being viewed doesn't help anyone. Same reasoning
            // as bitesmart_render_guide_single()'s show_guide_link => false
            // for its own chapters, just the other direction.
            'show_chapter_link' => false,
            'collapsible'       => false,
            'show_video_intro'  => true,
        ) );
        ?>

        <?php echo $chapter_navigation; // phpcs:ignore ?>

        <?php
        // "Share this Chapter" — sits right above the AddToAny share
        // buttons, per Janet. Not AddToAny's own built-in "Sharing Header"
        // option (Settings → AddToAny) on purpose: that setting is a
        // single site-wide value shared by every post/page AddToAny shows
        // on, so it can't say anything chapter-specific like this. Works
        // purely through filter ordering instead, no coupling to the
        // AddToAny plugin's code at all: this whole function's output
        // becomes $content inside WordPress's 'the_content' filter chain
        // (see bitesmart_guide_single_content_filter() below), added at
        // PHP's default priority (10); AddToAny's own content filter
        // (A2A_SHARE_SAVE_add_to_content(), add-to-any/add-to-any.php)
        // hooks the SAME filter at priority 98, appending its share
        // buttons well after ours has already run. Landing this heading
        // as the LAST thing in our own output guarantees it sits
        // immediately above whatever AddToAny appends next — no need to
        // know anything about AddToAny's own markup/timing beyond that
        // one priority ordering. Scoped to a chapter's own single page
        // only (this function) — not the Guide's own accordion page.
        ?>
        <h2 class="guide-chapter-share-heading"><?php esc_html_e( 'Share this Chapter', 'custom-blocks' ); ?></h2>
    </div>
    <?php
    return ob_get_clean();
}

/**
 * Swaps in the above for the SINGULAR, MAIN-QUERY view of a Guide Chapter —
 * guarded so this never touches an excerpt, a REST API `content` field
 * render, a related-post loop, or any other secondary call to
 * 'the_content' that happens to run during the same request. Guide itself
 * is headless (no permalink — see guide-cpt.php), so there's no
 * is_singular('guide') branch here; its only front end is
 * render_guide_single_block() below. Falls back to the original $content
 * (effectively empty either way — a chapter's real content gets shown via
 * bitesmart_render_guide_chapter_row() instead) if the post somehow
 * doesn't resolve.
 *
 * @param string $content
 * @return string
 */
function bitesmart_guide_single_content_filter( $content ) {
    if ( ! is_main_query() || ! in_the_loop() || ! is_singular( 'guide_chapter' ) ) {
        return $content;
    }

    $replacement = bitesmart_render_guide_chapter_single( get_the_ID() );
    return $replacement ? $replacement : $content;
}
add_filter( 'the_content', 'bitesmart_guide_single_content_filter' );

/**
 * render_callback for custom/guide-single — see this file's header comment
 * (form #2) and block.json. Thin wrapper: all the real work is
 * bitesmart_render_guide_single() above, same function the Guide's own
 * permalink uses via bitesmart_guide_single_content_filter().
 *
 * NO guideId attribute/picker (removed 2026-08-16) — per Janet: "we only
 * ever have the one guide, so this dropdown is unnecessary." Resolves the
 * site's one Guide itself via bitesmart_get_the_main_guide() (guide-cpt.php,
 * "Custom Post Types for BBS" plugin) instead — same "there's only ever
 * one, don't make anyone pick" pattern already used for a chapter's own
 * parent-Guide relationship (bitesmart_guide_chapter_autofill_guide_id(),
 * guide-chapter-cpt.php), and now shared with render_guide_description_block()
 * (guide-description.php) too.
 *
 * @return string HTML, or '' if no Guide exists yet or it isn't published.
 */
function render_guide_single_block() {
    $guide = bitesmart_get_the_main_guide();
    if ( ! $guide || 'publish' !== $guide->post_status ) {
        // Front end: render nothing (e.g. no Guide created yet, or it's
        // still a draft).
        return '';
    }

    return bitesmart_render_guide_single( $guide->ID );
}
