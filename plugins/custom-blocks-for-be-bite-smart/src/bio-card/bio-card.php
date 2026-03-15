<?php

function render_bio_card_block( $attributes, $content ) {
    // $content = the InnerBlocks HTML (WordPress handles this automatically)

    $name               = $attributes['name'] ?? '';
    $role               = $attributes['role'] ?? '';
    $affiliation        = $attributes['affiliation'] ?? '';
    $professional_email = $attributes['professionalEmail'] ?? '';
    $personal_email     = $attributes['personalEmail'] ?? '';
    $linked_in          = $attributes['linkedIn'] ?? '';
    $short_bio          = $attributes['shortBio'] ?? '';
    $photo_id           = $attributes['photoId'] ?? null;

    // ── Photo ────────────────────────────────────────────────────────────
    $photo = '';
    if ( $photo_id ) {
        $photo = wp_get_attachment_image(
            $photo_id,
            'medium',
            false,
            [
                'sizes' => '(max-width: 600px) 100vw, 288px',
                'class' => 'bio-photo',
                'alt'   => esc_attr( wp_strip_all_tags( $name ) ),
            ]
        );
    }

    // ── Contact links ─────────────────────────────────────────────────────
    $mailto = '';
    if ( $professional_email ) {
        $mailto = 'mailto:' . esc_attr( $professional_email );
        if ( $personal_email ) {
            $mailto .= '?cc=' . esc_attr( $personal_email );
        }
    }

    $contact_links = '';
    if ( $professional_email || $linked_in ) {
        $message_link = $professional_email ? sprintf(
            '<a href="%s" class="block-toggle-btn">
                <span class="message-icon-wrapper"></span>
                <span>Message</span>
            </a>',
            esc_url( $mailto )
        ) : '';

        $linkedin_link = $linked_in ? sprintf(
            '<a href="%s" class="block-toggle-btn is-style-outline" target="_blank" rel="noopener noreferrer">
                <span class="linkedin-icon-wrapper"></span>
                <span>LinkedIn</span>
            </a>',
            esc_url( $linked_in )
        ) : '';

        $contact_links = '<div class="bio-contact-links">' . $message_link . $linkedin_link . '</div>';
    }

    // ── Build output ──────────────────────────────────────────────────────
    ob_start();
    ?>
    <article class="wp-block-custom-bio-card custom-block-card custom-block-border">
        <div class="bio-main">

            <div class="bio-section-1">

                <?php echo $photo; ?>

                <div class="bio-details">
                    <?php if ( $name ) : ?>
                        <h3><?php echo wp_kses_post( $name ); ?></h3>
                    <?php endif; ?>

                    <?php if ( $role ) : ?>
                        <p class="bio-role capitalized-and-colored"><?php echo wp_kses_post( $role ); ?></p>
                    <?php endif; ?>

                    <?php if ( $affiliation ) : ?>
                        <p class="bio-affiliation"><?php echo wp_kses_post( $affiliation ); ?></p>
                    <?php endif; ?>

                    <?php if ( $professional_email ) : ?>
                        <span class="bio-email-display">
                            <span><?php echo esc_html( $professional_email ); ?></span>
                        </span>
                    <?php endif; ?>

                    <?php echo $contact_links; ?>

                    <?php if ( $short_bio ) : ?>
                        <div class="bio-short"><?php echo wp_kses_post( $short_bio ); ?></div>
                    <?php endif; ?>

                    <button class="expanded-bio-toggle show-more-btn">
                        <span>Read Full Biography</span>
                        <span class="bio-chevron"></span>
                    </button>
                </div>

            </div>

            <div class="bio-section-2 expanded-bio-content">
                <?php echo $content; // InnerBlocks content — already sanitized by WP ?>
                <button class="expanded-bio-toggle show-less-btn">
                    <span>Collapse Biography</span>
                    <span class="bio-chevron"></span>
                </button>
            </div>

        </div>
    </article>
    <?php
    return ob_get_clean();
}