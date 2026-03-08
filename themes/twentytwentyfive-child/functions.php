<?php
function twentytwentyfive_child_enqueue_styles() {
    // Enqueue parent style
    wp_enqueue_style( 'twentytwentyfive-parent', get_template_directory_uri() . '/style.css' );

    // Enqueue child style
    wp_enqueue_style( 'twentytwentyfive-child', get_stylesheet_directory_uri() . '/style.css', array('twentytwentyfive-parent'), '1.0.3' );
    //version number so returning visitors browser will download the new file

     // Additional partial CSS
    wp_enqueue_style( 'child-navbar', get_stylesheet_directory_uri() . '/css/navbar.css', array('twentytwentyfive-child'),  '1.0.3' );
    wp_enqueue_style( 'child-forminator', get_stylesheet_directory_uri() . '/css/forminator.css', array('twentytwentyfive-child'), '1.0.1' );
   // the partial css shared-block-styles is loaded instead in add_action
}
add_action( 'wp_enqueue_scripts', 'twentytwentyfive_child_enqueue_styles' );


// enqueue_block_assets since these styles are also used in the editor
add_action( 'enqueue_block_assets', function() {
    wp_enqueue_style(
        'child-shared-blocks',
        get_stylesheet_directory_uri() . '/css/shared-block-styles.css',
        array(),
        filemtime( get_stylesheet_directory() . '/css/shared-block-styles.css' )
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
function show_more_button_logic() {
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
add_action('wp_footer', 'show_more_button_logic');