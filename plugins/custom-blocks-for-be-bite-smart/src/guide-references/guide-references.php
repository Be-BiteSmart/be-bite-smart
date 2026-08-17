<?php
/**
 * Render callback for "custom/guide-references" — auto-lists every Citation
 * belonging to the site's one Guide, ordered by Citation Number. Added
 * 2026-08-16 as the "master list" half of the citations feature — see
 * [[be-bitesmart-guide-cpt-plan]] in memory for the full picture: a
 * chapter's inline "Cite" reference (guide-chapter-panel/citation-format.js)
 * links straight to one specific entry here via its stable
 * `id="citation-{postID}"` anchor, and a hover/focus tooltip
 * (guide-chapter-display/citation-tooltip.js) previews the same text
 * in place without navigating here at all.
 *
 * Same "CPT-backed display block, pulls everything live at render time"
 * shape as custom/guide-single/custom/guide-description — nothing is
 * duplicated into the block itself, so editing a citation's Number/Text/
 * DOI/HTML/PDF on its own edit screen updates this list (and every
 * chapter's live-resolved reference to it) automatically. No `guideId`
 * attribute/picker — same "there's only ever one Guide" simplification
 * those two blocks already went through this session (see either's own
 * header comment) — resolves the site's one Guide directly via
 * bitesmart_get_the_main_guide() (guide-cpt.php).
 */

/**
 * Every Citation belonging to $guide_id, published, ordered by Citation
 * Number (cast numeric so "2" sorts before "10") — same query SHAPE as
 * bitesmart_render_guide_single()'s own chapter list (guide-single.php):
 * an explicit number field is both the display label and the sort key, a
 * citation left with no number still appears (just wherever a numeric
 * cast of '' happens to sort).
 *
 * @param int $guide_id
 * @return WP_Post[]
 */
function bitesmart_get_guide_citations( $guide_id ) {
    $query = new WP_Query( array(
        'post_type'      => 'citation',
        'post_status'    => 'publish',
        'posts_per_page' => -1,
        'no_found_rows'  => true,
        'meta_query'     => array(
            'relation'      => 'AND',
            'guide_clause'  => array(
                'key'   => '_bitesmart_citation_guide_id',
                'value' => $guide_id,
            ),
            'number_clause' => array(
                'key'     => '_bitesmart_citation_number',
                'type'    => 'NUMERIC',
                'compare' => 'EXISTS',
            ),
        ),
        'orderby'        => array( 'number_clause' => 'ASC' ),
    ) );

    return $query->posts;
}

/**
 * One source-link field (DOI/HTML/PDF), rendered as a real `<a>` if the
 * stored value actually validates as a url, or as plain text otherwise —
 * these fields deliberately allow non-url text like "Not available" or
 * "Subscription / institutional access" (see citation-cpt.php's meta
 * registration comment), so this is the one place that decides which of
 * the two a given value actually is.
 *
 * @param string $label Field label, e.g. "DOI".
 * @param string $value The stored value, url or plain text.
 * @return string HTML, or '' if $value is empty.
 */
function bitesmart_render_citation_link_field( $label, $value ) {
    if ( ! $value ) {
        return '';
    }

    if ( filter_var( $value, FILTER_VALIDATE_URL ) ) {
        return sprintf(
            '<span class="guide-reference-link"><span class="guide-reference-link-label">%1$s:</span> <a href="%2$s" target="_blank" rel="noopener noreferrer">%2$s</a></span>',
            esc_html( $label ),
            esc_url( $value )
        );
    }

    return sprintf(
        '<span class="guide-reference-link"><span class="guide-reference-link-label">%1$s:</span> %2$s</span>',
        esc_html( $label ),
        esc_html( $value )
    );
}

/**
 * The References list markup itself — a plain `<ul>` with its own default
 * marker suppressed (list-style: none, see style.css), NOT `<ol>`: the
 * visible number comes entirely from each citation's own explicit Number
 * field (echoed directly), not the browser's auto-incrementing list
 * counter, so a citation left without a number, or a gap in the sequence,
 * never looks mismatched against a native `<ol>`'s own counting.
 *
 * Anchor id uses the citation's stable POST ID
 * (`id="citation-{$citation->ID}"`), not its (editable) Number — so
 * renumbering a citation in wp-admin can never break an already-authored
 * chapter link pointing at it; only the VISIBLE digit changes, the anchor
 * itself never does.
 *
 * @param int $guide_id
 * @return string
 */
function bitesmart_render_guide_references( $guide_id ) {
    $citations = bitesmart_get_guide_citations( $guide_id );

    ob_start();
    ?>
    <div class="guide-references">
        <?php if ( empty( $citations ) ) : ?>
            <p class="guide-references-empty"><?php esc_html_e( 'References are coming soon.', 'custom-blocks' ); ?></p>
        <?php else : ?>
            <ul class="guide-references-list">
                <?php foreach ( $citations as $citation ) : ?>
                    <?php
                    $number   = get_post_meta( $citation->ID, '_bitesmart_citation_number', true );
                    $text     = get_post_meta( $citation->ID, '_bitesmart_citation_text', true );
                    $doi      = get_post_meta( $citation->ID, '_bitesmart_citation_doi', true );
                    $html_url = get_post_meta( $citation->ID, '_bitesmart_citation_html_url', true );
                    $pdf      = get_post_meta( $citation->ID, '_bitesmart_citation_pdf', true );

                    if ( ! $text ) {
                        continue; // nothing to show yet for this one
                    }
                    ?>
                    <li id="citation-<?php echo esc_attr( $citation->ID ); ?>" class="guide-reference">
                        <?php if ( $number ) : ?>
                            <span class="guide-reference-number"><?php echo esc_html( $number ); ?>.</span>
                        <?php endif; ?>
                        <span class="guide-reference-text">
                            <?php echo wp_kses_post( $text ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- already wp_kses_post()'d at save time (citation-cpt.php); re-run here since kses is the correct escaping function for stored post-meta HTML, not raw output ?>
                        </span>
                        <?php
                        // DOI/HTML/PDF: each opens in a new tab when it IS a
                        // real link — deliberately the only links in this
                        // whole feature that do, since everything else here
                        // is internal site navigation (same-tab, matching
                        // this codebase's existing convention throughout),
                        // but these leave the site entirely to a third-party
                        // source. bitesmart_render_citation_link_field()
                        // already escapes everything it outputs.
                        $links  = bitesmart_render_citation_link_field( __( 'DOI', 'custom-blocks' ), $doi );
                        $links .= bitesmart_render_citation_link_field( __( 'HTML', 'custom-blocks' ), $html_url );
                        $links .= bitesmart_render_citation_link_field( __( 'PDF', 'custom-blocks' ), $pdf );
                        if ( $links ) :
                            ?>
                            <span class="guide-reference-links"><?php echo $links; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- already escaped inside bitesmart_render_citation_link_field() ?></span>
                        <?php endif; ?>
                    </li>
                <?php endforeach; ?>
            </ul>
        <?php endif; ?>
    </div>
    <?php
    return ob_get_clean();
}

/**
 * render_callback for custom/guide-references — thin wrapper, all the real
 * work is bitesmart_render_guide_references() above.
 *
 * @return string HTML, or '' if no Guide exists yet or it isn't published.
 */
function render_guide_references_block() {
    $guide = bitesmart_get_the_main_guide();
    if ( ! $guide || 'publish' !== $guide->post_status ) {
        return '';
    }

    return bitesmart_render_guide_references( $guide->ID );
}
