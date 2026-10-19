<?php
/**
 * Shared server-rendered download-card presentation.
 *
 * Content sources remain responsible for fetching their data, then pass a
 * normalized item and per-language resources to these helpers.
 */

/**
 * Render the actions for one language in a downloadable card.
 *
 * @param string $lang      Language code.
 * @param array  $resource Resource data: pdf_url, download_url, coming_soon.
 * @param array  $options  Card options: viewer_enabled, ids, and item_label.
 * @return string
 */
function bitesmart_render_download_card_language_row( $lang, $resource, $options ) {
    $is_es        = 'es' === $lang;
    $language     = $is_es ? __( 'Spanish', 'custom-blocks' ) : __( 'English', 'custom-blocks' );
    $tag          = $is_es ? 'ES' : 'ENG';
    $pdf_url      = isset( $resource['pdf_url'] ) ? $resource['pdf_url'] : '';
    $download_url = isset( $resource['download_url'] ) ? $resource['download_url'] : '';
    $coming_soon  = ! empty( $resource['coming_soon'] );
    $viewer       = ! empty( $options['viewer_enabled'] );
    $target_id    = isset( $options['target_ids'][ $lang ] ) ? $options['target_ids'][ $lang ] : '';
    $group_id     = isset( $options['group_id'] ) ? $options['group_id'] : '';
    $item_label   = isset( $options['item_label'] ) ? $options['item_label'] : __( 'PDF', 'custom-blocks' );

    if ( ! $pdf_url && ! $download_url && ! $coming_soon ) {
        return '';
    }

    ob_start();
    ?>
    <div class="download-card-language-row">
        <span class="download-card-language-label"><?php echo esc_html( $language ); ?></span>
        <?php if ( $pdf_url ) : ?>
            <?php if ( $viewer ) : ?>
                <button class="ecd-toggle block-toggle-btn" data-target="<?php echo esc_attr( $target_id ); ?>" data-group="<?php echo esc_attr( $group_id ); ?>" data-expanded="false" data-lang="<?php echo esc_attr( $lang ); ?>">
                    <span class="btn-label btn-label--view"><?php echo esc_html( sprintf( __( 'View %s (%s)', 'custom-blocks' ), $item_label, $tag ) ); ?></span>
                    <span class="btn-label btn-label--hide"><?php echo esc_html( sprintf( __( 'Hide %s (%s)', 'custom-blocks' ), $item_label, $tag ) ); ?></span>
                </button>
            <?php endif; ?>
            <a href="<?php echo esc_url( $pdf_url ); ?>" download class="block-toggle-btn is-style-outline download-card-pdf-download" data-lang="<?php echo esc_attr( $lang ); ?>">
                <?php echo esc_html( sprintf( __( 'Download (%s)', 'custom-blocks' ), $tag ) ); ?>
            </a>
        <?php elseif ( $download_url ) : ?>
            <a href="<?php echo esc_url( $download_url ); ?>" class="ecd-toggle block-toggle-btn<?php echo $is_es ? ' is-style-outline ecd-toggle--outline' : ''; ?>" download data-lang="<?php echo esc_attr( $lang ); ?>">
                <span class="btn-label"><?php echo esc_html( sprintf( __( 'Download (%s)', 'custom-blocks' ), $tag ) ); ?></span>
            </a>
        <?php else : ?>
            <button class="ecd-toggle block-toggle-btn ecd-toggle--coming-soon<?php echo $is_es ? ' is-style-outline ecd-toggle--outline' : ''; ?>" disabled aria-disabled="true">
                <span class="btn-label"><?php echo esc_html( sprintf( __( 'Coming Soon (%s)', 'custom-blocks' ), $tag ) ); ?></span>
            </button>
        <?php endif; ?>
    </div>
    <?php
    return ob_get_clean();
}

/**
 * Render a card from content-source-neutral data.
 *
 * @param array $item Card data: id, class_name, number, number_label, type,
 *                    title, languages, viewer_enabled, and item_label.
 * @return string
 */
function bitesmart_render_download_card( $item ) {
    $number        = isset( $item['number'] ) ? $item['number'] : '';
    $number_label  = isset( $item['number_label'] ) ? $item['number_label'] : __( 'Episode', 'custom-blocks' );
    $type          = isset( $item['type'] ) ? $item['type'] : '';
    $title         = isset( $item['title'] ) ? $item['title'] : '';
    $item_label    = isset( $item['item_label'] ) ? $item['item_label'] : __( 'PDF', 'custom-blocks' );
    $id            = isset( $item['id'] ) ? $item['id'] : '';
    $class_name    = isset( $item['class_name'] ) ? $item['class_name'] : '';
    $toggle_prefix = isset( $item['toggle_prefix'] ) ? $item['toggle_prefix'] : 'download-card';
    $viewer_enabled = ! empty( $item['viewer_enabled'] );
    $group_id      = $toggle_prefix . '-grp-' . $id;
    $target_ids    = array(
        'en' => $toggle_prefix . '-en-' . $id,
        'es' => $toggle_prefix . '-es-' . $id,
    );
    $options       = array(
        'viewer_enabled' => $viewer_enabled,
        'item_label'     => $item_label,
        'target_ids'     => $target_ids,
        'group_id'       => $group_id,
    );
    $language_rows = array();
    foreach ( array( 'en', 'es' ) as $lang ) {
        $resource = isset( $item['languages'][ $lang ] ) ? $item['languages'][ $lang ] : array();
        $row      = bitesmart_render_download_card_language_row( $lang, $resource, $options );
        if ( $row ) {
            $language_rows[] = $row;
        }
    }

    ob_start();
    ?>
    <section id="<?php echo esc_attr( $id ); ?>" class="download-card-block <?php echo esc_attr( $class_name ); ?>">
        <?php if ( $number ) : ?>
            <div class="bright-chip"><?php echo esc_html( $number ); ?></div>
        <?php endif; ?>

        <?php if ( $number || $type || $title ) : ?>
            <div class="ecd-header">
                <?php if ( $number || $type ) : ?>
                    <span class="capitalized-and-colored">
                        <?php
                        $heading_parts = array();
                        if ( $number ) {
                            $heading_parts[] = sprintf( '%s %s', $number_label, $number );
                        }
                        if ( $type ) {
                            $heading_parts[] = $type;
                        }
                        echo esc_html( implode( ' · ', $heading_parts ) );
                        ?>
                    </span>
                <?php endif; ?>
                <?php if ( $title ) : ?>
                    <h3 class="ecd-title"><?php echo esc_html( $title ); ?></h3>
                <?php endif; ?>
            </div>
        <?php endif; ?>

        <?php if ( $language_rows ) : ?>
            <div class="download-card-buttons">
                <?php foreach ( $language_rows as $row ) : ?>
                    <?php echo $row; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped by renderer ?>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>

        <?php if ( $viewer_enabled ) : ?>
            <?php foreach ( array( 'en', 'es' ) as $lang ) : ?>
                <?php $pdf_url = isset( $item['languages'][ $lang ]['pdf_url'] ) ? $item['languages'][ $lang ]['pdf_url'] : ''; ?>
                <?php if ( $pdf_url ) : ?>
                    <div id="<?php echo esc_attr( $target_ids[ $lang ] ); ?>" class="ecd-viewer">
                        <iframe data-src="<?php echo esc_url( $pdf_url ); ?>" width="100%" height="600px" title="<?php echo esc_attr( sprintf( __( 'PDF Document (%s)', 'custom-blocks' ), 'es' === $lang ? 'ES' : 'ENG' ) ); ?>"></iframe>
                    </div>
                <?php endif; ?>
            <?php endforeach; ?>
        <?php endif; ?>
    </section>
    <?php
    return ob_get_clean();
}
