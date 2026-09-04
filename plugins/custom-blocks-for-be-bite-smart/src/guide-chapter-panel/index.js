import "./citation-format";
import { registerPlugin } from "@wordpress/plugins";
import { PluginDocumentSettingPanel } from "@wordpress/editor";
import { createElement as el } from "@wordpress/element";
import { useEntityProp } from "@wordpress/core-data";
import { TextControl, TextareaControl, ToggleControl, FormTokenField } from "@wordpress/components";
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
// The "./citation-format" import (2026-08-16) piggybacks on that exact
// same enqueue for a second reason: it's not a sidebar field at all, it's
// the "Cite" RichText format available in the chapter's own canvas text —
// see citation-format.js's own header comment for the full "why" it lives
// here instead of its own separate bundle.
//
// Search Synonyms is a FormTokenField (add/remove chips) as of 2026-09-04,
// NOT a plain text field like every other *-fields block's Synonyms/Keywords
// section — this chapter's Synonyms can now be inherited by a linked Q&A
// Entry (_bitesmart_qa_link_chapter_id, qa-entry-cpt.php), which stores
// which tokens it's opted OUT of by their TEXT, not a stable id (see
// bitesmart_qa_entry_chapter_keywords() in learning-search.php, custom-blocks
// plugin, and [[be-bitesmart-qa-chapter-link-plan]] in memory for the full
// reasoning). A plain text field lets an editor rename a token in place
// (e.g. fixing a typo) without changing what LOOKS like the same entry,
// which would silently break any linked Q&A's exclude for that text. Chips
// make "rename" impossible — only remove-and-add, which correctly reads as
// a different token to any linked entry. Storage is untouched either way:
// value/onChange here just split/join the same comma-separated string
// _bitesmart_chapter_keywords_by_lang has always stored (see
// keywordTokens()/setKeywordTokens() below) — no meta shape, sanitize
// callback, or REST schema change on this field.
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
  const keywords = meta._bitesmart_chapter_keywords_by_lang || {};

  const updateMeta = (key, value) => setMeta({ ...meta, [key]: value });
  const setVideoUrl = (code, url) =>
    updateMeta("_bitesmart_chapter_videos_by_lang", { ...videos, [code]: url });
  const setKeywords = (code, text) =>
    updateMeta("_bitesmart_chapter_keywords_by_lang", { ...keywords, [code]: text });
  // Tokens in, comma-string out — storage/sanitize/REST schema on this meta
  // field stay exactly what they were before FormTokenField existed here
  // (see the "Search Synonyms" section below for why this is a token field
  // now, not a plain text field).
  const keywordTokens = (code) =>
    (keywords[code] || "")
      .split(",")
      .map((token) => token.trim())
      .filter(Boolean);
  const setKeywordTokens = (code, tokens) => setKeywords(code, tokens.join(", "));

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
    el(
      "p",
      { className: "components-base-control__help", style: { marginTop: 0 } },
      __(
        "The downloadable PDF button shown at the bottom of every chapter is uploaded once, on the Guide's own edit screen — not per chapter.",
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

    el(TextControl, {
      label: __("Question", "custom-blocks"),
      value: meta._bitesmart_chapter_question || "",
      onChange: (val) => updateMeta("_bitesmart_chapter_question", val),
      placeholder: __("e.g. What should I do if my dog won't stop growling?", "custom-blocks"),
      help: __(
        "A parent-facing question about this chapter, for future use linking it from a Q&A Entry. Not shown anywhere on the site yet.",
        "custom-blocks",
      ),
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

    el("p", { style: { fontWeight: 600, marginBottom: 4 } }, __("Search Synonyms", "custom-blocks")),
    el(
      "p",
      { className: "components-base-control__help", style: { marginTop: 0 } },
      __(
        "Internal search-matching phrases, not shown to visitors — not automatically translated, so fill in each language directly. A Q&A Entry can link to this chapter and inherit these terms (see [[be-bitesmart-qa-chapter-link-plan]] in memory) — to fix a typo, remove the old token and add the corrected one, rather than editing it in place, so any Q&A Entry that had it toggled off doesn't silently get it back under new text.",
        "custom-blocks",
      ),
    ),
    ...languages.map((lang) =>
      el(FormTokenField, {
        key: `keyword-${lang.code}`,
        label: `${__("Synonyms", "custom-blocks")} (${lang.name})`,
        value: keywordTokens(lang.code),
        onChange: (tokens) => setKeywordTokens(lang.code, tokens),
        placeholder: __("e.g. growl, growling, snapped, aggressive", "custom-blocks"),
      }),
    ),
  );
}

registerPlugin("guide-chapter-panel", { render: GuideChapterPanel });
