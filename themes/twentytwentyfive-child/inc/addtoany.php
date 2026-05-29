<?php

/**
 * AddToAny — append UTM params to shared URLs for attribution.
 *
 * Must run in wp_head before AddToAny’s script reads a2a_config.
 */

function bebitesmart_addtoany_config() {
    if ( is_admin() ) {
        return;
    }
    ?>
    <script>
    var a2a_config = a2a_config || {};
    a2a_config.linkurl = window.location.href.split('?')[0] + '?utm_source=word_of_mouth&utm_medium=share&utm_campaign=site_share';
    </script>
    <?php
}

add_action( 'wp_head', 'bebitesmart_addtoany_config', 1 );
