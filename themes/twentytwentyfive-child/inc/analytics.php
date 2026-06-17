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
// Inline PDF opens: coloring-books-viewed-{lang} on coloring block; default pdf-viewed-{lang} elsewhere.
// Optional data-track on block wrapper (pdf-toggle, educational-content-download) sets a custom slug:
//   data-track="partnership-pdf" → partnership-pdf-viewed-english, partnership-pdf-downloaded-english, etc.
//
// ── Script timing (read this before changing selectors or init) ───────────────
// This file prints one inline <script> from wp_footer. Two timing rules matter:
//
// 1) Elements that appear LATER in the HTML (e.g. TranslatePress floating switcher at the
//    very end of <body>) are NOT in the DOM when the script first runs. Do not use
//    querySelectorAll('.trp-language-switcher').forEach(...) at parse time — it finds nothing.
//    Use document-level click delegation instead (see language switcher block below).
//
// 2) Gutenberg block markup in page content IS already in the DOM when this script runs, so
//    querySelectorAll on .pdf-toggle, .download-card-pdf-download, etc. is fine.
//
// ── Clicks that leave the page or start a download ────────────────────────────
// Plausible sends custom events via XHR. If the browser navigates or starts a file download
// on the same click, the request is often aborted and the event never reaches the dashboard
// (the plugin's automatic "file download" goal may still appear — different code path).
// Use trackThenNavigate / trackDownloadClick: preventDefault → invokePlausible(..., { callback })
// → then navigate or trigger a synthetic <a download> click. Always use typeof check — on some
// pages window.plausible is truthy but not a function (plugin stub), which broke downloads.

function track_user_interactions() {

    // ── Shared helpers (injected into the inline script below) ─────────────────
    //
    // track(eventName) — fire-and-forget; OK when the page does not unload (PDF view, Watch Now).
    // eventName(category, action, lang) — builds names like coloring-books-downloaded-english.
    // getLang / langFromDataAttr — language from button label (EN)/(ES) or data-lang or episode toggle.
    // pdfTrackingSlug — reads data-track from the nearest block wrapper.
    // trackPdfView — inline PDF open only (not download links).
    // pdfDownloadEventName + trackDownloadClick — PDF file downloads with slug/block fallbacks.
    // trackThenNavigate — language switcher; same beacon-then-continue pattern as downloads.

    $shared_helpers = "
        function invokePlausible(eventName, options) {
            if (typeof window.plausible !== 'function') return false;
            window.plausible(eventName, options);
            return true;
        }

        function track(eventName) {
            invokePlausible(eventName);
        }

        // After we prevented the real click, start the download from a temporary link so the
        // Plausible callback can finish first (same href + download attribute as the original).
        function triggerFileDownload(link) {
            const temp = document.createElement('a');
            temp.href = link.href;
            if (link.hasAttribute('download')) {
                temp.setAttribute('download', link.getAttribute('download') || '');
            }
            if (link.target) {
                temp.target = link.target;
            }
            temp.style.display = 'none';
            document.body.appendChild(temp);
            temp.click();
            document.body.removeChild(temp);
        }

        // Ignore modified clicks so open-in-new-tab still works without our handler blocking them.
        function isPrimaryClick(event) {
            return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
        }

        // Language switcher: defer window.location until Plausible acknowledges the event.
        function trackThenNavigate(event, link, plausibleEventName) {
            if (!plausibleEventName || !isPrimaryClick(event)) return;
            event.preventDefault();
            let proceeded = false;
            function proceed() {
                if (proceeded) return;
                proceeded = true;
                window.location.href = link.href;
            }
            if (invokePlausible(plausibleEventName, { callback: proceed })) {
                // Fallback if callback never runs (ad blocker, network error).
                setTimeout(proceed, 750);
            } else {
                proceed();
            }
        }

        // PDF / video file downloads: same pattern as trackThenNavigate but triggers download instead.
        function trackDownloadClick(event, link, plausibleEventName) {
            if (!plausibleEventName || !isPrimaryClick(event)) return;
            event.preventDefault();
            let proceeded = false;
            function proceed() {
                if (proceeded) return;
                proceeded = true;
                triggerFileDownload(link);
            }
            if (invokePlausible(plausibleEventName, { callback: proceed })) {
                setTimeout(proceed, 750);
            } else {
                proceed();
            }
        }

        // Plausible goals use full names: language-switched-english, language-switched-spanish.
        function languageNameFromSwitcherLink(link) {
            const fromLabel = link.querySelector('.trp-language-item-name')?.textContent?.trim().toLowerCase();
            if (fromLabel) return fromLabel;
            const fromTitle = link.getAttribute('title')?.trim().toLowerCase();
            if (fromTitle) return fromTitle;
            return 'unknown';
        }

        function eventName(category, action, lang) {
            return lang ? category + '-' + action + '-' + lang : category + '-' + action;
        }

        const LANG_ANALYTICS = {
            en: 'english',
            es: 'spanish',
            hi: 'hindi',
        };

        function analyticsNameForLangCode(code) {
            if (!code) return null;
            const normalized = String(code).toLowerCase().split('-')[0];
            return LANG_ANALYTICS[normalized] || normalized;
        }

        function getLang(btn) {
            // Check button label text for language markers like (EN), (ENG), (ES)
            const label = (btn.querySelector('.btn-label')?.textContent || btn.textContent || '').toUpperCase();
            if (/\\(ENG\\)|\\(EN\\)/i.test(label)) return 'english';
            if (/\\(ES\\)/i.test(label)) return 'spanish';
            if (/\\(HI\\)|\\(HIN\\)/i.test(label)) return 'hindi';
            // Active language on episode cards (segmented picker or legacy toggle)
            const card = btn.closest('.video-episode-block');
            if (card) {
                const active = card.querySelector('.lang-segment.active, .toggle-label.active');
                const fromEpisode = analyticsNameForLangCode(active?.dataset.lang);
                if (fromEpisode) return fromEpisode;
            }
            return null;
        }

        function langFromDataAttr(btn) {
            const raw = btn.getAttribute('data-lang');
            const fromAttr = analyticsNameForLangCode(raw);
            if (fromAttr) return fromAttr;
            return getLang(btn);
        }

        // Optional editor field PDF tracking slug → data-track on the block wrapper (save.js / pdf-toggle).
        function pdfTrackingSlug(btn) {
            const container = btn.closest('.educational-content-download-block, .educational-coloring-book-download-block, .pdf-toggle-block');
            return container?.dataset?.track || null;
        }

        function pdfViewCategory(btn) {
            const container = btn.closest('.educational-coloring-book-download-block, .educational-content-download-block, .pdf-toggle-block');
            if (container?.classList.contains('educational-coloring-book-download-block')) {
                return 'coloring-books';
            }
            return null;
        }

        function trackPdfView(btn) {
            const lang = langFromDataAttr(btn);
            if (!lang) return;
            const slug = pdfTrackingSlug(btn);
            if (slug) {
                track(eventName(slug, 'viewed', lang));
                return;
            }
            const category = pdfViewCategory(btn);
            if (category) {
                track(eventName(category, 'viewed', lang));
                return;
            }
            track(eventName('pdf', 'viewed', lang));
        }

        function pdfDownloadEventName(link) {
            const lang = langFromDataAttr(link) || getLang(link);
            if (!lang) return null;
            const slug = pdfTrackingSlug(link);
            if (slug) {
                return eventName(slug, 'downloaded', lang);
            }
            if (link.closest('.educational-coloring-book-download-block')) {
                return eventName('coloring-books', 'downloaded', lang);
            }
            if (link.closest('.educational-content-download-block')) {
                return eventName('educational-content', 'downloaded', lang);
            }
            return eventName('pdf', 'downloaded', lang);
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

    // PDF file downloads (pdf-toggle + download-card rows). Class download-card-pdf-download is
    // required so we fire a custom event instead of relying only on Plausible's auto file-download.
    $track_pdf_downloads = "
        document.querySelectorAll('.download-card-pdf-download').forEach(function(link) {
            link.addEventListener('click', function(event) {
                trackDownloadClick(event, link, pdfDownloadEventName(link));
            });
        });
    ";

    ?>
    <script>
    <?php echo $shared_helpers; ?>

    // ── TranslatePress language switcher (every page) ─────────────────────────
    //
    // WHY document.addEventListener instead of querySelectorAll('.trp-language-switcher'):
    // View page source on production: this <script> appears ABOVE the floating switcher <nav>.
    // Scripts run as the parser reaches them, so the switcher does not exist yet — forEach on
    // .trp-language-switcher attaches zero listeners. Delegation on document still works on click.
    //
    // WHY not '.trp-switcher-dropdown-list .trp-language-item':
    // With "opposite language" enabled (trp-opposite-language), the only visible link sits in
    // .trp-language-switcher-inner; the dropdown list is often empty (hidden + inert). That
    // selector matched nothing on bebitesmart.org and broke both production and Playwright.
    //
    // Event: language-switched-{lang} where {lang} is from .trp-language-item-name (e.g. spanish).
    document.addEventListener('click', function(event) {
        const link = event.target.closest('.trp-language-switcher a.trp-language-item');
        if (!link) return;
        const lang = languageNameFromSwitcherLink(link);
        trackThenNavigate(event, link, eventName('language', 'switched', lang));
    });

    <?php if ( is_page( 'learn' ) ) : ?>
        // ── Education page ─────────────────────────────────────────────

        // Episode video file downloads (educational-video-download block only)
        document.querySelectorAll('.educational-video-download-block .ecd-toggle--download').forEach(function(btn) {
            btn.addEventListener('click', function(event) {
                const lang = getLang(btn);
                if (!lang) return;
                trackDownloadClick(event, btn, eventName('episode-videos', 'downloaded', lang));
            });
        });

        // Other educational download links (external URL fields only)
        document.querySelectorAll('.educational-content-download-block .ecd-toggle--download').forEach(function(btn) {
            btn.addEventListener('click', function(event) {
                const lang = getLang(btn);
                if (!lang) return;
                trackDownloadClick(event, btn, eventName('educational-content', 'downloaded', lang));
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


    <?php elseif ( is_page( 'evidence' ) ) : ?>
        // ── Evidence / research articles page ──────────────────────────

        <?php echo $track_article_clicks; ?>


    <?php elseif ( is_front_page() ) : ?>
        // ── Home page ──────────────────────────────────────────────────

        <?php echo $track_documentary; ?>

    <?php endif; ?>
    // PDF toggle + download-card listeners (blocks are in post content, already in DOM at parse time).
        <?php echo $track_pdf_clicks; ?>
        <?php echo $track_pdf_downloads; ?>
    </script>
    <?php
}

// Priority 10 is default; raising priority does not help the switcher — it is output after this hook.
add_action('wp_footer', 'track_user_interactions', 10);
