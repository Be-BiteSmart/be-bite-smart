import { registerBlockType } from "@wordpress/blocks";
import { createElement as el } from "@wordpress/element";
import { useBlockProps, RichText } from "@wordpress/block-editor";
import { useEntityProp } from "@wordpress/core-data";
import { TextControl } from "@wordpress/components";
import { __ } from "@wordpress/i18n";

// This block IS the Citation edit screen's main content — locked into
// place via the 'template' + template_lock: 'all' args on the citation
// CPT, registered in the separate Custom Post Types for BBS plugin (see
// its includes/citation-cpt.php; this plugin depends on that one being
// active — see this plugin's "Requires Plugins" header). Mirrors
// custom/resource-fields (src/resource-fields/index.js) — see that file's
// header comment for the full rationale (locked canvas over a sidebar
// panel, save() returns null since everything here is post meta via
// useEntityProp).
//
// DOI / HTML Link / PDF Link are three SEPARATE plain-text fields
// (deliberately TextControl, not a url-shaped input) — added 2026-08-16
// after the first version of this block only had one generic "Source URL"
// and the import built against it silently dropped Janet's real DOI/PDF
// data. Kept as plain text because a meaningful number of these values
// aren't urls at all (e.g. "Not available", "Subscription / institutional
// access") — see citation-cpt.php's meta registration comment.
//
// Citation Text uses RichText, NOT TextareaControl — the first field in
// this plugin to do so. Deliberate: a real citation commonly needs an
// italicized journal/book title or an inline link to the source, learned
// from the Usage Rights field earlier this session (built as plain text
// first, had to be reworked once the real content turned out to need
// formatting) — built with room for that from the start here instead.
// RichText's value/onChange work directly with an HTML string when used
// this way (no `multiline`/`identifier` needed for a single field like
// this), the same low-level pattern core itself uses for small formatted
// text fields outside the main block canvas. allowedFormats keeps the
// toolbar to just what a citation plausibly needs (bold/italic/link) —
// not the full canvas-level format list.

function CitationFieldsEdit() {
  const blockProps = useBlockProps({ className: "citation-fields-editor" });

  // meta can briefly be undefined on the very first render, before the
  // post's entity record resolves in the data store — default to {} so the
  // fields below don't throw and take the block down with them.
  const [meta = {}, setMeta] = useEntityProp("postType", "citation", "meta");

  const updateMeta = (key, value) => setMeta({ ...meta, [key]: value });

  return el(
    "div",
    blockProps,

    el("h2", { className: "citation-fields-heading" }, __("Citation Details", "custom-blocks")),
    el(
      "p",
      { className: "citation-fields-hint" },
      __(
        "The “Add title” field above is an internal label only (e.g. “Smith et al., 2020”) — it's never shown to a site visitor. The Citation Text below is the actual public-facing reference.",
        "custom-blocks",
      ),
    ),

    el(TextControl, {
      label: __("Citation Number", "custom-blocks"),
      value: meta._bitesmart_citation_number || "",
      onChange: (val) => updateMeta("_bitesmart_citation_number", val),
      placeholder: "e.g. 14",
      help: __(
        "Both the number shown on the References page and the sort order there. A chapter's own inline “Cite” link shows this same number, kept in sync automatically — no need to update anything on the chapter side if this ever changes.",
        "custom-blocks",
      ),
    }),

    el("p", { style: { fontWeight: 600, marginBottom: 4 } }, __("Citation Text", "custom-blocks")),
    el(
      "p",
      { className: "components-base-control__help", style: { marginTop: 0 } },
      __("The full reference, shown on the References page and in a chapter's hover/focus preview.", "custom-blocks"),
    ),
    el(
      "div",
      {
        style: {
          border: "1px solid #757575",
          borderRadius: "2px",
          padding: "8px 12px",
          minHeight: "80px",
          marginBottom: "24px",
          background: "#fff",
        },
      },
      el(RichText, {
        tagName: "div",
        value: meta._bitesmart_citation_text || "",
        onChange: (val) => updateMeta("_bitesmart_citation_text", val),
        placeholder: __("e.g. Smith, J. (2020). Title of the study. Journal Name, 12(3), 45–60.", "custom-blocks"),
        allowedFormats: ["core/bold", "core/italic", "core/link"],
      }),
    ),

    el("p", { style: { fontWeight: 600, marginBottom: 4, marginTop: 24 } }, __("Source Links", "custom-blocks")),
    el(
      "p",
      { className: "components-base-control__help", style: { marginTop: 0 } },
      __(
        "Each of these three is optional and can be a real link OR plain text like “Not available” — whichever the source actually has. Only real links show up as clickable on the References page; plain text just displays as-is.",
        "custom-blocks",
      ),
    ),

    el(TextControl, {
      label: __("DOI", "custom-blocks"),
      value: meta._bitesmart_citation_doi || "",
      onChange: (val) => updateMeta("_bitesmart_citation_doi", val),
      placeholder: "https://doi.org/... or “Not available”",
    }),

    el(TextControl, {
      label: __("HTML Link", "custom-blocks"),
      value: meta._bitesmart_citation_html_url || "",
      onChange: (val) => updateMeta("_bitesmart_citation_html_url", val),
      placeholder: "https://...",
    }),

    el(TextControl, {
      label: __("PDF Link", "custom-blocks"),
      value: meta._bitesmart_citation_pdf || "",
      onChange: (val) => updateMeta("_bitesmart_citation_pdf", val),
      placeholder: "https://... or “Not available”",
    }),
  );
}

registerBlockType("custom/citation-fields", {
  edit: CitationFieldsEdit,
  save: () => null,
});
