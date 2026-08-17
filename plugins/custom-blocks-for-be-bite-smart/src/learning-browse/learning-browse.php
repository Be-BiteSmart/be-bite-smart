<?php
/**
 * Render callback for "custom/learning-browse" — the type-filter checkboxes
 * + paginated "All X" browse list split OUT of custom/learning-search on
 * 2026-08-16 (see that block's own file-level comment,
 * src/learning-search/learning-search.php, for the full "why").
 *
 * Meant to be placed alongside a custom/learning-search block set to the
 * SAME Stage on a real Stage archive page — its type filter also narrows
 * that sibling block's live search results (see the stage-matched lookup
 * in learning-search/view.js's getEnabledTypes()). Deliberately NOT placed
 * on the pooled Guide search page (Stage=Guide) — a persistent "All
 * Chapters" list there would just duplicate custom/guide-single's own
 * chapter list at /learning/guide/, which is the entire reason this split
 * happened.
 *
 * Reuses learning-search.php's shared helpers as-is
 * (bitesmart_build_stage_card_list(), bitesmart_render_learning_search_data(),
 * bitesmart_render_learning_search_type_filter(),
 * bitesmart_render_learning_search_strings()).
 * No require-order dependency on that file: none of these are called until
 * THIS block's render callback actually runs (well after every plugin file
 * has loaded), only required after it in custom-blocks-for-be-bite-smart.php
 * for readability — same "runtime vs. require-time" fact already true of
 * guide-chapter-display.php's bitesmart_render_guide_format_controls().
 *
 * Independently calls bitesmart_build_stage_card_list() for the same Stage
 * a sibling custom/learning-search block would use — a cheap transient-
 * cache hit when both are on the same page, at the cost of the full card
 * HTML+searchText being embedded twice on that page (accepted tradeoff for
 * genuine block independence — each block works correctly on its own with
 * no dependency on a sibling block's presence or DOM).
 */
function render_learning_browse_block( $attributes ) {
    $stage_slug = isset( $attributes['stageSlug'] ) ? sanitize_title( $attributes['stageSlug'] ) : '';

    if ( ! $stage_slug ) {
        if ( current_user_can( 'edit_posts' ) ) {
            return '<p class="learning-search-unconfigured">' .
                esc_html__( 'Learning Hub Browse: choose a Stage in the block settings.', 'custom-blocks' ) .
                '</p>';
        }
        return '';
    }

    $lang        = bitesmart_site_lang_code();
    $cards       = bitesmart_build_stage_card_list( $stage_slug, $lang );
    // Deliberately a DIFFERENT prefix than custom/learning-search's own
    // 'learning-search-' . $stage_slug — both blocks can be placed on the
    // same Stage page at once, and each needs its own non-colliding
    // {instance_id}-data / etc. ids.
    $instance_id = 'learning-browse-' . $stage_slug;

    $per_page    = 10;
    $total       = count( $cards );
    $total_pages = max( 1, (int) ceil( $total / $per_page ) );
    $page        = isset( $_GET['bs_page'] ) ? absint( wp_unslash( $_GET['bs_page'] ) ) : 1; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only pagination, no state change
    $page        = max( 1, min( $page, $total_pages ) );
    $page_cards  = array_slice( $cards, ( $page - 1 ) * $per_page, $per_page );

    ob_start();
    ?>
    <section class="wp-block-custom-learning-browse learning-browse-block" id="<?php echo esc_attr( $instance_id ); ?>" data-stage="<?php echo esc_attr( $stage_slug ); ?>" data-lang="<?php echo esc_attr( $lang ); ?>">

        <?php
        // Rendered first, above the browse list — same "sits above
        // everything, stable regardless of scroll/result state" reasoning
        // this had before the split (see git history / memory).
        bitesmart_render_learning_search_type_filter( $cards );

        // Same conditional as custom/learning-search's own copy (see that
        // block's render_learning_search_block()) — only the pooled Guide
        // pseudo-stage (100% chapters) shows the global bar; a real Stage
        // page relies on each chapter's own per-chapter badges instead, so
        // a handful of chapters mixed into a Q&A/Resource list doesn't get
        // a global control that applies to almost nothing on screen. In
        // practice this block is never placed on the Guide page at all
        // (see file header), so this never renders here — kept for
        // symmetry/documentation and in case that changes.
        if ( 'guide' === $stage_slug ) {
            echo bitesmart_render_guide_format_controls(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- own trusted markup
        }
        ?>

        <div class="learning-search-browse">
            <?php
            // No visible heading rendered here as of 2026-08-16 — Janet
            // adds her own Heading block above this block in the page
            // editor instead, for full styling control (see the matching
            // comment in learning-search.php's render_learning_search_block()).
            ?>

            <?php
            /*
             * This inner wrapper (rather than the ?bs_page=N links below
             * being the only pagination mechanism) exists so browse.js has
             * one clean target to replace wholesale once JS loads — see
             * initLearningBrowseBlock() there. What's here server-side is
             * real, working, no-JS-required pagination that JS then takes
             * over so the type-filter checkboxes above can affect it live,
             * without a page reload. If JS never loads, this is exactly
             * what a visitor sees and it works fine on its own.
             */
            ?>
            <div class="learning-search-browse-content">
                <?php if ( empty( $page_cards ) ) : ?>
                    <p class="learning-search-empty"><?php esc_html_e( 'Nothing has been added for this Stage yet.', 'custom-blocks' ); ?></p>
                <?php else : ?>
                    <div class="learning-search-browse-list">
                        <?php foreach ( $page_cards as $card ) : ?>
                            <?php echo $card['html']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- already-escaped HTML from render_qa_entry_block()/render_resource_block() ?>
                        <?php endforeach; ?>
                    </div>

                    <?php if ( $total_pages > 1 ) : ?>
                        <nav class="learning-search-pagination" aria-label="<?php esc_attr_e( 'Questions & Resources pages', 'custom-blocks' ); ?>">
                            <?php if ( $page > 1 ) : ?>
                                <a class="learning-search-page-link learning-search-prev" href="<?php echo esc_url( add_query_arg( 'bs_page', $page - 1 ) . '#' . $instance_id ); ?>">
                                    <?php esc_html_e( 'Previous', 'custom-blocks' ); ?>
                                </a>
                            <?php endif; ?>

                            <span class="learning-search-page-status">
                                <?php
                                printf(
                                    /* translators: 1: current page, 2: total pages */
                                    esc_html__( 'Page %1$d of %2$d', 'custom-blocks' ),
                                    (int) $page,
                                    (int) $total_pages
                                );
                                ?>
                            </span>

                            <?php if ( $page < $total_pages ) : ?>
                                <a class="learning-search-page-link learning-search-next" href="<?php echo esc_url( add_query_arg( 'bs_page', $page + 1 ) . '#' . $instance_id ); ?>">
                                    <?php esc_html_e( 'Next', 'custom-blocks' ); ?>
                                </a>
                            <?php endif; ?>
                        </nav>
                    <?php endif; ?>
                <?php endif; ?>
            </div>
        </div>

        <?php bitesmart_render_learning_search_data( $cards, $instance_id ); ?>
        <?php bitesmart_render_learning_search_strings( $instance_id, array( 'browse-empty-filtered', 'browse-prev', 'browse-next', 'browse-page-status', 'browse-pagination-label' ) ); ?>
    </section>
    <?php
    return ob_get_clean();
}
