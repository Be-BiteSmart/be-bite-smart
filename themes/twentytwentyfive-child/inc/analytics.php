<?php

// ============  Plausible Custom Event Tracking ================
// The Plausible script itself is injected by the Plausible Analytics
// WordPress plugin — no manual script tag needed here.
// Custom Events are enabled by default in the plugin, so window.plausible
// is available on every page.
//
// Events use kebab-case names with no custom props (free-tier friendly):
//   {category}-{action}-{language}  e.g. episode-videos-downloaded-english
//   {category}-{action}             e.g. documentary-watched, article-viewed
//
// Episode video downloads: custom/educational-video-download block only.
// Coloring book + flexible educational PDFs: coloring-book-download and educational-content-download.
// Inline PDF opens: default pdf-viewed-{lang}; optional data-track on educational-content-download.

function track_user_interactions() {

    // ── Shared helpers ─────────────────────────────────────────────────────────
    //
    // track(eventName)
    //   Fires a Plausible custom event with no props.
    //
    // eventName(category, action, lang)
    //   Builds kebab-case event names, e.g. coloring-books-viewed-english.
    //   Pass null for lang when the content has no language variant.
    //
    // getLang(btn)
    //   Detects language from two sources:
    //   1. Button label text — checks .btn-label (or full text) for (EN), (ENG), (ES).
    //      Used by ECD download/PDF buttons and pdf-toggle buttons.
    //   2. Active language toggle — reads .toggle-label.active[data-lang] on the episode card.
    //      Used by Watch Now / play buttons which have no label text to read.
    //   Returns 'english', 'spanish', or null (for content with no language variant).
    //
    // trackPdfView(btn)
    //   Fires {slug}-viewed-{lang} when data-track is set on the ECD or pdf-toggle wrapper,
    //   otherwise pdf-viewed-{lang}.

    $shared_helpers = "
        function track(eventName) {
            if (!window.plausible) return;
            plausible(eventName);
        }

        function eventName(category, action, lang) {
            return lang ? category + '-' + action + '-' + lang : category + '-' + action;
        }

        function getLang(btn) {
            // Check button label text for language markers like (EN), (ENG), (ES)
            const label = (btn.querySelector('.btn-label')?.textContent || btn.textContent || '').toUpperCase();
            if (/\\(ENG\\)|\\(EN\\)/i.test(label)) return 'english';
            if (/\\(ES\\)/i.test(label)) return 'spanish';
            // Fall back to active language toggle (for Watch Now / play buttons on episode cards)
            const card = btn.closest('.video-episode-block');
            if (card) {
                const active = card.querySelector('.toggle-label.active');
                if (active?.dataset.lang === 'en') return 'english';
                if (active?.dataset.lang === 'es') return 'spanish';
            }
            return null;
        }

        function langFromDataAttr(btn) {
            const raw = btn.getAttribute('data-lang');
            if (raw === 'en') return 'english';
            if (raw === 'es') return 'spanish';
            return getLang(btn);
        }

        function pdfTrackingSlug(btn) {
            const container = btn.closest('.educational-content-download-block, .educational-coloring-book-download-block, .pdf-toggle-block');
            return container?.dataset?.track || null;
        }

        function trackPdfView(btn) {
            const lang = langFromDataAttr(btn);
            if (!lang) return;
            const slug = pdfTrackingSlug(btn);
            if (slug) {
                track(eventName(slug, 'viewed', lang));
            } else {
                track(eventName('pdf', 'viewed', lang));
            }
        }
    ";

    // ── Reusable event blocks ──────────────────────────────────────────────────
    //
    // Each block fires one Plausible custom event (kebab-case, no props).
    // Language variants append -english or -spanish; articles and the documentary omit language.

    // Mini-documentary play buttons (home + education pages) — no language variant
    $track_documentary = "
        document.querySelectorAll('.video-quote-watch-button, .video-quote-block .play-button').forEach(function(btn) {
            btn.addEventListener('click', function() {
                track('documentary-watched');
            });
        });
    ";

    // External article link clicks (news + library pages) — no language variant
    $track_article_clicks = "
        document.querySelectorAll('.custom-block-card a[target=\"_blank\"]').forEach(function(link) {
            link.addEventListener('click', function() {
                track('article-viewed');
            });
        });
    ";

    // PDF inline viewer opens via pdf-toggle block — has EN/ES variants, fires only on open.
    // Uses capture:true so this handler reads data-expanded before toggle.js resets it.
    // toggle.js clears data-expanded on all group buttons before we'd see it in bubble phase.
    $track_pdf_clicks = "
        document.querySelectorAll('.pdf-toggle').forEach(function(btn) {
            btn.addEventListener('click', function() {
                // Read data-expanded on the button before toggle.js resets it (capture phase)
                const isAlreadyOpen = btn.getAttribute('data-expanded') === 'true';
                if (isAlreadyOpen) return;

                trackPdfView(btn);
            }, { capture: true }); // capture:true — runs before toggle.js which resets data-expanded on click
        });
    ";

    ?>
    <script>
    <?php echo $shared_helpers; ?>

    // ── Global — fires on every page ───────────────────────────────────────────
    // Track TranslatePress language switcher clicks.
    // Reads the language name from .trp-language-item-name (e.g. "spanish").
    document.querySelectorAll('.trp-switcher-dropdown-list .trp-language-item').forEach(function(link) {
        link.addEventListener('click', function() {
            const lang = link.querySelector('.trp-language-item-name')?.textContent?.trim().toLowerCase() || 'unknown';
            track(eventName('language', 'switched', lang));
        });
    });

    <?php if ( is_page( 'education' ) ) : ?>
        // ── Education page ─────────────────────────────────────────────

        // Episode video file downloads (educational-video-download block only)
        document.querySelectorAll('.educational-video-download-block .ecd-toggle--download').forEach(function(btn) {
            btn.addEventListener('click', function() {
                const lang = getLang(btn);
                if (!lang) return;
                track(eventName('episode-videos', 'downloaded', lang));
            });
        });

        // Other educational download links (PDF block type with link fields filled in)
        document.querySelectorAll('.educational-content-download-block .ecd-toggle--download').forEach(function(btn) {
            btn.addEventListener('click', function() {
                const lang = getLang(btn);
                if (!lang) return;
                track(eventName('educational-content', 'downloaded', lang));
            });
        });

        // Episode video plays — getLang reads the active EN/ES toggle on the card
        document.querySelectorAll('.watch-now-button, .video-episode-block .play-button').forEach(function(btn) {
            btn.addEventListener('click', function() {
                const lang = getLang(btn);
                if (!lang) return;
                track(eventName('episodes', 'watched', lang));
            });
        });

        // PDF viewer opens (coloring-book + educational-content blocks; not video download rows)
        // Uses capture:true so this handler reads display state before toggle.js touches anything.
        document.querySelectorAll(
            '.educational-coloring-book-download-block .ecd-toggle:not(.ecd-toggle--download):not(.ecd-toggle--coming-soon), ' +
            '.educational-content-download-block .ecd-toggle:not(.ecd-toggle--download):not(.ecd-toggle--coming-soon)'
        ).forEach(function(btn) {
            btn.addEventListener('click', function() {
                // reads live computed style before toggle.js touches anything
                const targetId = btn.getAttribute('data-target');
                const viewer = document.getElementById(targetId);
                if (viewer && getComputedStyle(viewer).display !== 'none') return;

                trackPdfView(btn);
            }, { capture: true }); // capture:true — runs before toggle.js which resets data-expanded on click
        });

        <?php echo $track_documentary; ?>


    <?php elseif ( is_page( ['news-media', 'legal'] ) ) : ?>
        // ── News / Legal pages ─────────────────────────────────────────

        <?php echo $track_article_clicks; ?>

        // "Read More" expands on press releases and text articles — no language variant
        document.querySelectorAll('.read-more-toggle').forEach(function(btn) {
            btn.addEventListener('click', function() {
                if (btn.getAttribute('data-expanded') === 'true') return;
                track('article-viewed');
            });
        });


    <?php elseif ( is_page( 'library' ) ) : ?>
        // ── Library page ───────────────────────────────────────────────

        <?php echo $track_article_clicks; ?>


    <?php elseif ( is_front_page() ) : ?>
        // ── Home page ──────────────────────────────────────────────────

        <?php echo $track_documentary; ?>

    <?php endif; ?>
    // runs on every page, covers any pdf-toggle block
        <?php echo $track_pdf_clicks; ?>
    </script>
    <?php
}

add_action('wp_footer', 'track_user_interactions', 10);
