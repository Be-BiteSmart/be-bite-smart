<?php

add_filter('template_include', function($template) {
    if (is_page()) {
        $post = get_post();
        if ($post && has_block('custom/qr-experience', $post)) {
            return get_stylesheet_directory() . '/no-header-footer.php';
        }
    }
    return $template;
});

// its only used in twentytwentyfive_child_enqueue_style, so technically this could go in that function. However, defining functions inside other functions in PHP works but is bad practice.

function get_asset( $path ) {

// this would cause a fatal error if the style.asset.php didn't exist: $style_asset = include get_stylesheet_directory() . '/build/style.asset.php';

// this version checks if the file exists before trying to include it
// If it's missing, instead of crashing it just returns a dummy fallback array [ 'version' => '1.0.0' ]. WordPress then loads the CSS without a version hash — not ideal, but the site stays up.
    $full = get_stylesheet_directory() . '/build/' . $path;
    return file_exists( $full ) ? include $full : [ 'version' => '1.0.0', 'dependencies' => [] ];
}

require_once get_stylesheet_directory() . '/inc/analytics.php';
require_once get_stylesheet_directory() . '/inc/addtoany.php';

function twentytwentyfive_child_enqueue_styles() {

//  the asset.php files only contain a version hash — WordPress never actually loads the compiled JS files from build/. The CSS files themselves still live at their original paths (style.css, css/navbar.css etc.) — the build step just generates the hash fingerprint we use for versioning to avoid css caching issues.
        // why not filemtime? because it has issues with git
        // manual version control would of continued to work, but its tedious and easy to forget to update the version number


    // Enqueue parent style
    wp_enqueue_style( 'twentytwentyfive-parent', get_template_directory_uri() . '/style.css' );

       $style_asset = get_asset( 'style.asset.php' );
    wp_enqueue_style(
        'twentytwentyfive-child',
        get_stylesheet_directory_uri() . '/style.css',
        array('twentytwentyfive-parent'),
        $style_asset['version']
    );

     $navbar_asset = get_asset( 'navbar.asset.php' );
    wp_enqueue_style(
        'child-navbar',
        get_stylesheet_directory_uri() . '/css/navbar.css',
        array('twentytwentyfive-child'),
        $navbar_asset['version']
    );

     $forminator_asset = get_asset( 'forminator.asset.php' );
if ( is_page( 'contact' ) ) {
    wp_enqueue_style(
        'child-forminator',
        get_stylesheet_directory_uri() . '/css/forminator.css',
        array('twentytwentyfive-child'),
        $forminator_asset['version']
    );
}
}
add_action( 'wp_enqueue_scripts', 'twentytwentyfive_child_enqueue_styles' );

/* load hero image immediately on front page */
add_action( 'wp_head', function() {
    if ( ! is_front_page() ) return;

    global $post;
    $blocks = parse_blocks( $post->post_content );

    foreach ( $blocks as $block ) {
        if ( $block['blockName'] !== 'custom/hero' ) continue;

        $attrs  = $block['attrs'];
        $sm_url = esc_url( $attrs['bgImageSmUrl'] ?? '' );
        $md_url = esc_url( $attrs['bgImageMdUrl'] ?? '' );
        $lg_url = esc_url( $attrs['bgImageLgUrl'] ?? '' );

        /* mirror picture element media queries image choosing logic, since preload tries to use srcset which won't always match the media query logic*/
        if ( $sm_url ) echo '<link rel="preload" as="image" href="' . $sm_url . '" media="(max-width: 640px)" fetchpriority="high">' . "\n";
        if ( $md_url ) echo '<link rel="preload" as="image" href="' . $md_url . '" media="(min-width: 641px) and (max-width: 1280px)" fetchpriority="high">' . "\n";
        if ( $lg_url ) echo '<link rel="preload" as="image" href="' . $lg_url . '" media="(min-width: 1281px)" fetchpriority="high">' . "\n";

        break;
    }
}, 1 );

add_action('wp_head', function() {
    echo '<link rel="preconnect" href="https://www.googletagmanager.com">' . "\n";
}, 0); // priority 0 = very early, want that DNS connection starting before anything else

// Preserve UTM params and the ?qr flag through WordPress's canonical redirects.
//
// WordPress sometimes redirects URLs for SEO reasons (e.g. adding a trailing slash).
// By default those redirects drop all query params, which means UTMs sent to Plausible
// and the ?qr flag used to detect QR code visitors would be lost before the page loads.
//
// This filter intercepts canonical redirects and re-appends any UTM params + ?qr
// to the destination URL instead of cancelling the redirect entirely.
// The redirect still happens — the params just come along for the ride.
add_filter('redirect_canonical', function($redirect_url, $requested_url) {
    if (empty($_GET) || !$redirect_url) {
        return $redirect_url;
    }

    $utm_keys = array_filter(array_keys($_GET), function($key) {
        return strpos($key, 'utm_') === 0 || $key === 'qr';
    });

    if (empty($utm_keys)) {
        return $redirect_url;
    }

    // Re-append UTMs to the redirect target instead of cancelling
    $utm_params = array_intersect_key($_GET, array_flip($utm_keys));
    $redirect_url = add_query_arg(
        array_map('sanitize_text_field', $utm_params),
        $redirect_url
    );

    return $redirect_url;
}, 10, 2);

// went with optional rather than swap to avoid CLS
// Optional: the browser gets a very short window (roughly 100ms) to load the font. If it loads in time, great. If not, it uses the fallback for that entire page load and doesn't swap at all. Zero layout shift, and on the next visit the font is cached so it loads instantly.
add_filter( 'wp_font_face_resolver_style_properties', function( $properties ) {
    $properties['font-display'] = 'optional';
    return $properties;
} );

// enqueue_block_assets since these styles are also used in the editor
add_action( 'enqueue_block_assets', function() {
    $shared_blocks_asset =  get_asset( 'shared-blocks.asset.php' );
    wp_enqueue_style(
        'child-shared-blocks',
        get_stylesheet_directory_uri() . '/css/shared-block-styles.css',
        array(),
        $shared_blocks_asset['version']
    );
});


// deletes autosaves on post save
add_action( 'post_updated', function( $post_id ) {
    global $wpdb;
    $wpdb->query( $wpdb->prepare(
        "DELETE FROM {$wpdb->posts} 
         WHERE post_parent = %d 
         AND post_type = 'revision' 
         AND post_name LIKE %s",
        $post_id,
        '%-autosave-v1'
    ) );
}, 10, 1 );



 
// ======================== Jquery =========================

// defers jquery, to improve loading speed. Only done on landing page, since forminator on the contact page will break otherwise
//Logged-in users get jQuery normally otherwise translate press's edit screen won't appear for the 1st page, visitors get the deferred version
add_filter( 'script_loader_tag', function( $tag, $handle ) {
    if ( !is_front_page() ) return $tag;
    if ( is_user_logged_in() ) return $tag;
    $defer = [ 'jquery-core', 'jquery-migrate', 'trp-language-switcher-js-v2','eeb-js-frontend' ];
    // eeb-js-frontend is the email/phone encoder plugin
    if ( in_array( $handle, $defer ) ) {
        return str_replace( '<script ', '<script defer ', $tag );
    }
    return $tag;
}, 10, 2 );

// preloads fonts used above the fold on the front page
add_action( 'wp_head', function() {
    if ( !is_front_page() ) return;
 // Font Library auto-generates font URLs without www at upload time.
// Better Search Replace found no stored URLs to fix — they're generated
// dynamically at render time, so the preload must match the output instead.
    $base = 'https://bebitesmart.org/wp-content/uploads/fonts/';
    // Urbanist 400 // hero text
    echo '<link rel="preload" href="' . $base . 'L0xjDF02iFML4hGCyOCpRdycFsGxSrqD-R4fE5OrS8SlKw.woff2" as="font" type="font/woff2" crossorigin>' . "\n";
    // Urbanist 600, buttons and navbar donate
    echo '<link rel="preload" href="' . $base . 'L0xjDF02iFML4hGCyOCpRdycFsGxSrqDLBkfE5OrS8SlKw.woff2" as="font" type="font/woff2" crossorigin>' . "\n";
    // Omnes 500 — navbar, logo, top hero text
    echo '<link rel="preload" href="' . $base . 'Omnes-Medium.woff2" as="font" type="font/woff2" crossorigin>' . "\n";
}, 1 );


// removes page author information from discord embeds
add_filter( 'oembed_response_data', 'disable_embeds_filter_oembed_response_data_' );
function disable_embeds_filter_oembed_response_data_( $data ) {
    unset($data['author_url']);
    unset($data['author_name']);
    return $data;
}

/*
  DESKTOP SUBMENU LOGIC (min-width: 601px)
  =========================================
  Visibility is controlled by two mechanisms working together:

  1. HOVER (CSS) — the submenu is hidden by default via opacity/visibility.
     Hovering over the parent item shows it. No JS involved.

  2. CLICK TO CLOSE (JS + CSS) — clicking the chevron toggle adds an
     is-force-closed class to the submenu, which overrides the hover state
     and hides the menu even while the mouse is still inside it.
     Clicking again removes is-force-closed, handing control back to hover.

  3. MOUSELEAVE (JS) — when the mouse leaves the submenu, is-force-closed
     is removed so hover works normally on the next visit.

  4. CHEVRON ROTATION — aria-expanded on the toggle button is flipped
     manually in JS to match the open/closed state, which the CSS
     chevron rotation rule watches.

  Note: We do NOT rely on WP's Interactivity API to manage submenu state.
  It uses its own internal store that can't be accessed directly, so we
  bypass it entirely and own the state ourselves via CSS classes.
*/

function submenu_hover_logic() {
    ?>
    <script>
        // DESKTOP SUBMENU LOGIC
        // =====================
        // Hover open/close is handled entirely by CSS — no JS needed for that.
        //
        // JS only handles:
        //
        // 1. CLICK TO CLOSE — toggles is-force-closed on the submenu, which beats
        //    the CSS hover rule and hides the menu even while the mouse is inside.
        //    aria-expanded is flipped manually to keep the chevron rotation in sync.
        //    Mouseleave removes is-force-closed so hover works normally next time.


     function initSubmenus() {
    const submenus = document.querySelectorAll('.wp-block-navigation-submenu');
    // If WP's Interactivity API hasn't rendered the nav yet, bail and let the MutationObserver retry
    if (submenus.length === 0) return false;

    submenus.forEach(function (submenu) {
        const toggleButton = submenu.querySelector(':scope > button.wp-block-navigation-submenu__toggle');
        // grabs the chevron toggle button.

        // Don't mark as initialized until we've confirmed the toggle button exists —
        // if we set the flag before this check and toggleButton is null, we bail early
        // but the flag is already set so the MutationObserver never retries.
        if (!toggleButton) return;

        // Skip if we've already attached listeners to this submenu
        if (submenu.dataset.initialized) return;
        submenu.dataset.initialized = 'true';

        // Click toggles is-force-closed on/off.     
        // capture phase (true) ensures our handler runs before WP's bubble-phase handlers.
        toggleButton.addEventListener('click', function (e) {
            e.stopImmediatePropagation();
               // stopImmediatePropagation() prevents WP's Interactivity API handlers on the
        // same button from firing after ours.
            e.preventDefault();

            if (window.matchMedia('(max-width: 600px)').matches) {
                // Mobile: no hover state, so just directly toggle aria-expanded.
                // is-force-closed is not used on mobile.
                const isOpen = toggleButton.getAttribute('aria-expanded') === 'true';
                toggleButton.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
            } else {
                // Desktop: hover opens submenus, so this clicking even force-closes them.
                 submenu.classList.toggle('is-force-closed');
                 // this toggle flips the class. If it was absent, it's now added. If it was present, it's now removed. The toggle happens first.
                 // If currently force-closed, remove it so hover takes back over.
                // If currently open (via hover), force-close it.
                const isClosed = submenu.classList.contains('is-force-closed');
                // in older browsers, toggle wouldn't reliably give a boolean. So we're defensively checking if the classList contains the is-force-closed class instead. 
                // This syncs aria-expanded to match. if force-closed, chevron points down (false), if open, chevron points up (true).
                toggleButton.setAttribute('aria-expanded', isClosed ? 'false' : 'true');
            }
        }, true); // true = capture phase, fires BEFORE WP's handlers

        // Reset force-closed when mouse leaves so hover works normally next visit.
        // Skip on touch/mobile — mouseleave fires on tap there and closes submenus unintentionally.
        submenu.addEventListener('mouseleave', function () {
            if (window.matchMedia('(max-width: 600px)').matches) return;
            submenu.classList.remove('is-force-closed');
            toggleButton.setAttribute('aria-expanded', 'false');
        });
    });

    // Clicking outside removes is-force-closed from all submenus.
    // Skip on mobile — not needed since is-force-closed isn't used there.
    document.addEventListener('click', function (e) {
        if (window.matchMedia('(max-width: 600px)').matches) return;
        if (!e.target.closest('.wp-block-navigation-submenu')) {
            document.querySelectorAll('.wp-block-navigation-submenu.is-force-closed').forEach(function (s) {
                s.classList.remove('is-force-closed');
            });
        }
    });

    return true;
}

        // Try immediately in case the nav is already rendered, then fall back to watching for WP's
        // Interactivity API to finish rendering the nav — it runs after DOMContentLoaded so the
        // toggle buttons may not exist yet when this script first executes.
        if (!initSubmenus()) {
            const observer = new MutationObserver(function () {
                if (initSubmenus()) {
                    observer.disconnect();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
    </script>
    <?php
}
add_action('wp_footer', 'submenu_hover_logic');


// ****************** show more button logic
// Toggles visibility of hidden content sections on the about page.
// Looks for a .show-more-button wrapper and a .show-more-content target,
// and toggles the is-visible class on click to show/hide the content.
function show_more_button_about_page() {
        if ( !is_front_page()) return;
    ?>
    <script>
        document.addEventListener('DOMContentLoaded', function () {
            const wrapper = document.querySelector(".show-more-button");
            // the button's outer div, which wordpress wraps each button in

            const content = document.querySelector(".show-more-content");

            if (!wrapper || !content) return;

            const button = wrapper.querySelector("a, button");
            // grab the actual button itself instead of the button's WordPress div
            const originalText = button.textContent;

            wrapper.addEventListener("click", function (e) {
                e.preventDefault(); // prevents jump if it's an anchor

                content.classList.toggle("is-visible");

                if (content.classList.contains("is-visible")) {
                    button.textContent = "Show Less";
                } else {
                    button.textContent = originalText;
                }
            });
        });
    </script>
    <?php
}
add_action('wp_footer', 'show_more_button_about_page');

/* force lazy load for images that aren't actually the lcp */

add_filter( 'the_content', function( $content ) {
    // Find any figure with no-lcp class and fix the img inside it
    return preg_replace_callback(
        '/<figure[^>]+class="[^"]*no-lcp[^"]*"[^>]*>.*?<img([^>]+)>/s',
        function( $matches ) {
            $img = str_replace( 'fetchpriority="high"', 'fetchpriority="low"', $matches[0] );
            $img = str_replace( 'decoding="async"', 'decoding="async" loading="lazy"', $img );
            return $img;
        },
        $content
    );
} );

/* improve accessibility of go to top button, when a keyboard users clicks it they now get sent to the skip link. Instead of being sent to the top of the browser */

/* Instead of using "load" (which caused a timing race with the plugin's own load listener
   that injects the button), we delegate to document instead. Document always exists 
   immediately, and we check each click as it happens. By which point the button 
   definitely exists. */

/* Capture phase (the third argument, true) means our listener travels DOWN the DOM 
   before jQuery's bubbling phase, so it fires before jQuery gets a chance to suppress it.
   The plugin's click handler ends with `return !1` which in jQuery is shorthand for 
   both e.preventDefault() and e.stopPropagation() — that's what was killing the bubbling 
   and blocking our previous delegated listeners. 
*/

/* so when we clicked on the button, it was supposed to bubble up to the document which was where the listener was waiting. However jquery's stopPropation blocked this entirely. 

jQuery's stopPropagation only stops the bubble — it has no power over the capture phase that already happened.*/

add_action( 'wp_footer', function() {
    ?>
    <script>
    (function() {
        document.addEventListener('click', function(e) {
            if (!e.target.closest('#wpfront-scroll-top-container')) return;

            const target = document.getElementById('wp--skip-link--target');
            // wp--skip-link--target is on main, so our target is main

            // When the browser follows the skip link natively, it handles moving focus to <main> itself as part of its built-in anchor navigation behaviour — it has special handling for this that bypasses the normal focusability rules.

            // But when JavaScript calls .focus() on <main>, it has no such special handling — it strictly requires the element to be programmatically focusable. Without tabindex="-1", it silently does nothing.
            if (!target) return;

            target.setAttribute('tabindex', '-1');

             //timeout is so it waits for the plugin's scroll animation to finish after 400ms(+ a small buffer)

             // If you call target.focus() immediately, the page is still mid-scroll. The browser can get confused about where focus should land while the viewport is moving, and may override it — which would send focus back to the browser chrome.
            setTimeout(function() {
                target.focus({ preventScroll: true });
            }, 450);
        }, true); // capture phase beats jQuery's stopPropagation
    })();
    </script>
    <?php
});