<?php

// ============  Plausible Custom Event Tracking ================
// The Plausible script itself is injected by the Plausible Analytics
// WordPress plugin — no manual script tag needed here.
// Custom Events are enabled by default in the plugin, so window.plausible
// is available on every page.
 
function track_user_interactions() {
 
    // ── Shared helpers ─────────────────────────────────────────────────────────
    //
    // toContentName(type, text, lang)
    //   Format (with language):    "video - my-title - english"
    //   Format (without language): "video - my-title"
    //   Pass null for lang on content with no language variant (articles, documentary).
    //
    // getLang(btn)
    //   Detects language from two sources:
    //   1. Button label text — checks .btn-label (or full text) for (EN), (ENG), (ES).
    //      Used by ECD download/PDF buttons and pdf-toggle buttons.
    //   2. Active language toggle — reads .toggle-label.active[data-lang] on the episode card.
    //      Used by Watch Now / play buttons which have no label text to read.
    //   Returns 'english', 'spanish', or null (for content with no language variant).
    //
    // buildProps(contentName, contentType, lang)
    //   Builds the Plausible props object, omitting content_language entirely
    //   when lang is null rather than sending a null value.
 
    $shared_helpers = "
        function toContentName(type, text, lang) {
            var name = (text || 'unknown').toLowerCase().replace(/\s+/g, '-');
            return lang ? type + ' - ' + name + ' - ' + lang : type + ' - ' + name;
        }
 
        function getLang(btn) {
            // Check button label text for language markers like (EN), (ENG), (ES)
            var label = (btn.querySelector('.btn-label')?.textContent || btn.textContent || '').toUpperCase();
            if (/\(EN\b|\(ENG\b/.test(label)) return 'english';
            if (/\(ES\b/.test(label)) return 'spanish';
            // Fall back to active language toggle (for Watch Now / play buttons on episode cards)
            var card = btn.closest('.video-episode-block');
            if (card) {
                var active = card.querySelector('.toggle-label.active');
                if (active?.dataset.lang === 'en') return 'english';
                if (active?.dataset.lang === 'es') return 'spanish';
            }
            return null;
        }
 
        function buildProps(contentName, contentType, lang) {
            var props = { content_name: contentName, content_type: contentType };
            if (lang) props.content_language = lang;
            return props;
        }
    ";
 
    // ── Reusable event blocks ──────────────────────────────────────────────────
    //
    // Each block fires one Plausible custom event and sends:
    //   content_name     — "pdf - my-title - english"
    //   content_type     — "pdf" | "article" | "video" | "download" | "language_switcher"
    //   content_language — "english" | "spanish"  (omitted entirely when content has no language variant)
    //
    // Articles and the documentary have no language variants, so they omit content_language.
 
    // Mini-documentary play buttons (home + education pages) — no language variant
    // PAGE_CONTEXT will be replaced with the actually page when echo'ed
   $track_documentary = "
    document.querySelectorAll('.video-quote-watch-button, .video-quote-block .play-button').forEach(function(btn) {
        btn.addEventListener('click', function() {
            if (!window.plausible) return;
            plausible('video_watched', { props: buildProps(
                toContentName('video', 'mini-documentary - __PAGE_CONTEXT__'),
                'video',
                null
            )});
        });
    });
";
 
    // External article link clicks (news + library pages) — no language variant
    $track_article_clicks = "
        document.querySelectorAll('.custom-block-card a[target=\"_blank\"]').forEach(function(link) {
            link.addEventListener('click', function() {
                if (!window.plausible) return;
                var card  = link.closest('.custom-block-card');
                var title = card?.querySelector('h3, h4')?.textContent?.trim()
                         || link.querySelector('h3, h4')?.textContent?.trim()
                         || link.textContent?.trim()
                         || 'unknown';
                plausible('article_viewed', { props: buildProps(
                    toContentName('article', title),
                    'article',
                    null
                )});
            });
        });
    ";
 
    // PDF inline viewer opens via pdf-toggle block — has EN/ES variants, fires only on open
$track_pdf_clicks = "
    document.querySelectorAll('.pdf-toggle').forEach(function(btn) {
        btn.addEventListener('click', function() {
            if (!window.plausible) return;
            if (btn.getAttribute('data-expanded') === 'true') return;
            var rawLang = btn.getAttribute('data-lang');
            var lang = rawLang === 'es' ? 'spanish' : rawLang === 'en' ? 'english' : getLang(btn);

            // Get the PDF filename from the iframe data-src in the target viewer

            var targetId = btn.getAttribute('data-target');
            var viewer   = document.getElementById(targetId);
            var iframe   = viewer?.querySelector('iframe[data-src], iframe[src]');
            var pdfUrl   = iframe?.getAttribute('data-src') || iframe?.getAttribute('src') || '';

            // decode URI and strip path, leaving just the filename without extension

            var fileName = '';

            //  .replace(/-+$/, '') strips one or more trailing hyphens from the filename before it gets passed to toContentName, so children-can-learn-safety- becomes children-can-learn-safety.
            
         try { fileName = decodeURIComponent(pdfUrl.split('/').pop().replace(/\.pdf$/i, '').replace(/-+$/, '')); }
catch(e) { fileName = pdfUrl.split('/').pop().replace(/\.pdf$/i, '').replace(/-+$/, ''); }

            plausible('pdf_viewed', { props: buildProps(
                toContentName('pdf', fileName || 'unknown', lang),
                'pdf',
                lang
            )});
        });
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
            if (!window.plausible) return;
            var lang = link.querySelector('.trp-language-item-name')?.textContent?.trim().toLowerCase() || 'unknown';
            plausible('language_switched', { props: {
                content_name: 'language-switcher - ' + lang,
                content_type: 'language_switcher',
                content_language: lang
            }});
        });
    });
 
    <?php if ( is_page( 'education' ) ) : ?>
        // ── Education page ─────────────────────────────────────────────
 
        // Video file downloads — getLang reads (EN)/(ES) from button label text
        document.querySelectorAll('.ecd-toggle--download').forEach(function(btn) {
            btn.addEventListener('click', function() {
                if (!window.plausible) return;
                var raw = btn.getAttribute('href').split('/').pop();
                var fileName;
                try   { fileName = decodeURIComponent(raw); }
                catch (e) { fileName = raw; }
                var lang = getLang(btn);
                plausible('video_downloaded', { props: buildProps(
                    toContentName('video', fileName, lang),
                    'download',
                    lang
                )});
            });
        });
 
        // Episode video plays — getLang reads the active EN/ES toggle on the card
        document.querySelectorAll('.watch-now-button, .video-episode-block .play-button').forEach(function(btn) {
            btn.addEventListener('click', function() {
                if (!window.plausible) return;
                var card  = btn.closest('.video-episode-block');
                var title = card?.querySelector('.episode-title')?.textContent?.trim() || 'unknown';
                var lang  = getLang(btn);
                plausible('video_watched', { props: buildProps(
                    toContentName('video', title, lang),
                    'video',
                    lang
                )});
            });
        });
 
        // PDF viewer opens on education page (ecd buttons, excluding download + coming-soon)
        // getLang reads (EN)/(ES) from button label text
        document.querySelectorAll('.ecd-toggle:not(.ecd-toggle--download):not(.ecd-toggle--coming-soon)').forEach(function(btn) {
            btn.addEventListener('click', function() {
                if (!window.plausible) return;
                if (btn.getAttribute('data-expanded') === 'true') return;
                var block   = btn.closest('.educational-content-download-block');
                var span    = block?.querySelector('.capitalized-and-colored')?.textContent?.trim() || '';
                var title   = block?.querySelector('.ecd-title')?.textContent?.trim() || 'unknown';
                // e.g. "Episode 1 · Coloring book - Respect the Bubble"
                var label   = span ? span + ' - ' + title : title;
                var lang    = getLang(btn);
                plausible('pdf_viewed', { props: buildProps(
                    toContentName('pdf', label, lang),
                    'pdf',
                    lang
                )});
            });
        });
 
    
        <?php echo str_replace('__PAGE_CONTEXT__', 'education-page', $track_documentary); ?>

 
 
    <?php elseif ( is_page( ['news-media', 'legal'] ) ) : ?>
        // ── News / Legal pages ─────────────────────────────────────────
 
        <?php echo $track_article_clicks; ?>
 
        // "Read More" expands on press releases and text articles — no language variant
        document.querySelectorAll('.read-more-toggle').forEach(function(btn) {
            btn.addEventListener('click', function() {
                if (!window.plausible) return;
                if (btn.getAttribute('data-expanded') === 'true') return;
                var card  = btn.closest('.custom-block-card');
                var title = card?.querySelector('h3')?.textContent?.trim() || 'unknown';
                plausible('article_viewed', { props: buildProps(
                    toContentName('article', title),
                    'article',
                    null
                )});
            });
        });
 
 
    <?php elseif ( is_page( 'library' ) ) : ?>
        // ── Library page ───────────────────────────────────────────────
 
        <?php echo $track_article_clicks; ?>
 
 
    <?php elseif ( is_front_page() ) : ?>
        // ── Home page ──────────────────────────────────────────────────
 
          <?php echo str_replace('__PAGE_CONTEXT__', 'home-page', $track_documentary); ?>

 
    <?php endif; ?>
   // runs on every page, covers any pdf-toggle block
        <?php echo $track_pdf_clicks; ?>
    </script>
    <?php
}
 
add_action('wp_footer', 'track_user_interactions', 10);