import { registerPlugin } from "@wordpress/plugins";
import { PluginDocumentSettingPanel } from "@wordpress/editor";
import { createElement as el } from "@wordpress/element";
import { useEntityProp } from "@wordpress/core-data";
import { MediaUpload, MediaUploadCheck } from "@wordpress/block-editor";
import { TextControl, TextareaControl, ToggleControl, Button } from "@wordpress/components";
import { __ } from "@wordpress/i18n";
import { getSiteLanguages } from "../shared/languages";

// UNLIKE every *-fields block in this plugin (episode-fields,
// resource-fields, qa-entry-fields, coloring-book-fields, guide-fields),
// this is NOT a locked-canvas block — it's a PluginDocumentSettingPanel, a
// sidebar panel. guide_chapter's editor canvas is deliberately left
// UNLOCKED (see guide-chapter-cpt.php and [[be-bitesmart-guide-cpt-plan]]
// in memory): post_content IS the chapter's real rich-text body, authored
// with the normal block editor, so there's no room for a canvas-filling
// fields block here — everything that ISN'T the chapter's text body lives
// in this sidebar panel instead. Its script is enqueued only on the
// guide_chapter edit screen (see bitesmart_enqueue_guide_chapter_panel() in
// this plugin's main PHP file), not registered as a block at all — no
// block.json next to this file, unlike every sibling directory.
//
// NO parent-Guide picker here anymore (an earlier version had a
// ComboboxControl + a lockPostSaving()-based "must pick one" requirement,
// same pattern as Q&A Entry's Stage requirement) — removed per Janet: with
// only ever one Guide (see guide-cpt.php), there's no real choice to make,
// so a picker was just a place to get it wrong or leave it blank. Every
// chapter's _bitesmart_chapter_guide_id is now auto-filled server-side
// instead — see bitesmart_guide_chapter_autofill_guide_id() in
// guide-chapter-cpt.php, hooked to rest_after_insert_guide_chapter (not
// save_post — same REST-timing lesson as
// bitesmart_guide_chapter_stage_term_reguard() in that same file: save_post
// fires before REST applies that request's own meta values, so a save_post-
// time fix would just get silently overwritten a moment later).

function GuideChapterPanel() {
  // meta can briefly be undefined on the very first render, before the
  // post's entity record resolves in the data store — default to {} so the
  // fields below don't throw and take the panel down with them.
  const [meta = {}, setMeta] = useEntityProp("postType", "guide_chapter", "meta");
  const languages = getSiteLanguages();
  const videos = meta._bitesmart_chapter_videos_by_lang || {};
  const pdfs = meta._bitesmart_chapter_pdf_by_lang || {};
  const keywords = meta._bitesmart_chapter_keywords_by_lang || {};

  const updateMeta = (key, value) => setMeta({ ...meta, [key]: value });
  const setVideoUrl = (code, url) =>
    updateMeta("_bitesmart_chapter_videos_by_lang", { ...videos, [code]: url });
  const setPdfUrl = (code, url) =>
    updateMeta("_bitesmart_chapter_pdf_by_lang", { ...pdfs, [code]: url });
  const setKeywords = (code, text) =>
    updateMeta("_bitesmart_chapter_keywords_by_lang", { ...keywords, [code]: text });

  return el(
    PluginDocumentSettingPanel,
    {
      name: "guide-chapter-details",
      title: __("Chapter Details", "custom-blocks"),
      initialOpen: true,
    },

    el(
      "p",
      { className: "components-base-control__help", style: { marginTop: 0 } },
      __(
        "This chapter is automatically part of the site's one Guide — nothing to pick here.",
        "custom-blocks",
      ),
    ),

    el(TextControl, {
      label: __("Chapter Number", "custom-blocks"),
      value: meta._bitesmart_chapter_number || "",
      onChange: (val) => updateMeta("_bitesmart_chapter_number", val),
      placeholder: "e.g. 1",
      help: __("Both the “Chapter N” label and the sort order within its Guide.", "custom-blocks"),
    }),

    el(TextareaControl, {
      label: __("Summary", "custom-blocks"),
      value: meta._bitesmart_chapter_summary || "",
      onChange: (val) => updateMeta("_bitesmart_chapter_summary", val),
      placeholder: __("Shown even when this chapter is collapsed.", "custom-blocks"),
    }),

    el("hr", { style: { margin: "16px 0" } }),

    el(ToggleControl, {
      label: __("Has a text version", "custom-blocks"),
      checked: !!meta._bitesmart_chapter_has_text,
      onChange: (val) => updateMeta("_bitesmart_chapter_has_text", val),
      help: __(
        "Turn on once the chapter body above is ready to count as this chapter's text version.",
        "custom-blocks",
      ),
    }),

    el("hr", { style: { margin: "16px 0" } }),

    el("p", { style: { fontWeight: 600, marginBottom: 4 } }, __("Video", "custom-blocks")),
    // key is prefixed "video-" — this map() and the Keywords one below both
    // key by lang.code ("en"/"es"/...), and since both are spread directly
    // into this SAME flat children array (not each wrapped in their own
    // Fragment), an unprefixed key: lang.code would collide across the two
    // groups (two children both keyed "en") even though they're visually in
    // different sections. That collision is what was actually causing the
    // tripled Vimeo URL fields Janet reported — not a language-list bug.
    ...languages.map((lang) =>
      el(TextControl, {
        key: `video-${lang.code}`,
        label: `${__("Vimeo URL", "custom-blocks")} (${lang.name})`,
        value: videos[lang.code] || "",
        onChange: (val) => setVideoUrl(lang.code, val),
        placeholder: "https://vimeo.com/123456789",
      }),
    ),
    el(TextControl, {
      label: __("Video Duration", "custom-blocks"),
      value: meta._bitesmart_chapter_video_duration || "",
      onChange: (val) => updateMeta("_bitesmart_chapter_video_duration", val),
      placeholder: __("e.g. 6 min", "custom-blocks"),
    }),

    el("hr", { style: { margin: "16px 0" } }),

    el("p", { style: { fontWeight: 600, marginBottom: 4 } }, __("Downloadable PDF", "custom-blocks")),
    el(
      "p",
      { className: "components-base-control__help", style: { marginTop: 0 } },
      __(
        "Shown as a Download button at the bottom of this chapter, once expanded. Leave a language blank to skip its button.",
        "custom-blocks",
      ),
    ),
    // Same key-prefix reasoning as the Video/Keywords loops above — every
    // languages.map() spread into this flat children array needs a
    // per-group-prefixed key or same-lang.code children across groups
    // collide (see the comment above the Video loop for the real bug that
    // caused).
    ...languages.map((lang) =>
      el(
        "div",
        {
          key: `pdf-${lang.code}`,
          style: { display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" },
        },
        el(
          MediaUploadCheck,
          null,
          el(MediaUpload, {
            onSelect: (media) => setPdfUrl(lang.code, media.url),
            allowedTypes: ["application/pdf"],
            value: pdfs[lang.code],
            render: ({ open }) =>
              el(
                Button,
                { onClick: open, variant: "secondary" },
                `${pdfs[lang.code] ? __("Replace PDF", "custom-blocks") : __("Upload PDF", "custom-blocks")} (${lang.name})`,
              ),
          }),
        ),
        pdfs[lang.code] &&
          el("span", { style: { fontSize: "12px", color: "#50575e" } }, pdfs[lang.code].split("/").pop()),
      ),
    ),

    el("hr", { style: { margin: "16px 0" } }),

    el("p", { style: { fontWeight: 600, marginBottom: 4 } }, __("Search Keywords", "custom-blocks")),
    el(
      "p",
      { className: "components-base-control__help", style: { marginTop: 0 } },
      __(
        "Internal search-matching phrases, not shown to visitors — not automatically translated, so fill in each language directly.",
        "custom-blocks",
      ),
    ),
    ...languages.map((lang) =>
      el(TextControl, {
        key: `keyword-${lang.code}`,
        label: `${__("Keywords", "custom-blocks")} (${lang.name})`,
        value: keywords[lang.code] || "",
        onChange: (val) => setKeywords(lang.code, val),
        placeholder: __("e.g. growl, growling, snapped, aggressive", "custom-blocks"),
      }),
    ),
  );
}

registerPlugin("guide-chapter-panel", { render: GuideChapterPanel });
