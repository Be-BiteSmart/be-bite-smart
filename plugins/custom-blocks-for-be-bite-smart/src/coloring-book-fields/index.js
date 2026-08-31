import { registerBlockType } from "@wordpress/blocks";
import { createElement as el } from "@wordpress/element";
import { useBlockProps, MediaUpload, MediaUploadCheck } from "@wordpress/block-editor";
import { useEntityProp } from "@wordpress/core-data";
import { TextControl, Button } from "@wordpress/components";
import { __ } from "@wordpress/i18n";

// This block IS the Coloring Book edit screen's main content — locked into
// place via the 'template' + template_lock: 'all' args on the coloring_book
// CPT, registered in the separate Custom Post Types for BBS plugin (see its
// includes/coloring-book-cpt.php; this plugin depends on that one being
// active — see this plugin's "Requires Plugins" header). Mirrors
// custom/episode-fields and custom/resource-fields (src/episode-fields/,
// src/resource-fields/) — see episode-fields/index.js's header comment for
// the full rationale (locked canvas over a sidebar panel, save() returns
// null since everything here is post meta via useEntityProp).
//
// PDFs are English/Spanish only (two explicit MediaUpload fields, not
// looped over every site language) — matches the two languages
// custom/educational-coloring-book-download originally supported. Had a
// per-language Search Keywords section (same idiom as Episode/Resource)
// until 2026-08-30, when it was removed along with the rest of this CPT's
// Learning Hub search plumbing — see coloring-book-cpt.php's file header
// and [[be-bitesmart-coloring-book-status]] in memory.

function ColoringBookFieldsEdit() {
  const blockProps = useBlockProps({ className: "coloring-book-fields-editor" });

  // meta can briefly be undefined on the very first render, before the
  // post's entity record resolves in the data store — default to {} so the
  // fields below don't throw and take the block down with them.
  const [meta = {}, setMeta] = useEntityProp("postType", "coloring_book", "meta");

  const updateMeta = (key, value) => setMeta({ ...meta, [key]: value });

  return el(
    "div",
    blockProps,

    el("h2", { className: "coloring-book-fields-heading" }, __("Coloring Book Details", "custom-blocks")),
    el(
      "p",
      { className: "coloring-book-fields-hint" },
      __(
        "The coloring book's title goes in the “Add title” field above. Everything else is below.",
        "custom-blocks",
      ),
    ),

    el(TextControl, {
      label: __("Episode Number", "custom-blocks"),
      value: meta._bitesmart_coloring_book_episode_number || "",
      onChange: (val) => updateMeta("_bitesmart_coloring_book_episode_number", val),
      placeholder: "e.g. 1",
      help: __(
        "Optional, but filling this in gives the coloring book a stable, predictable link (e.g. “…#coloring-book-paws-to-prevent-ep-1”) instead of one based on its title.",
        "custom-blocks",
      ),
    }),

    el("h3", { className: "coloring-book-fields-subheading" }, __("PDFs", "custom-blocks")),

    el(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" } },
      el(
        MediaUploadCheck,
        null,
        el(MediaUpload, {
          onSelect: (media) => updateMeta("_bitesmart_coloring_book_pdf_url_en", media.url),
          allowedTypes: ["application/pdf"],
          value: meta._bitesmart_coloring_book_pdf_url_en,
          render: ({ open }) =>
            el(
              Button,
              { onClick: open, variant: "secondary" },
              meta._bitesmart_coloring_book_pdf_url_en
                ? __("Replace English PDF", "custom-blocks")
                : __("Upload English PDF", "custom-blocks"),
            ),
        }),
      ),
      meta._bitesmart_coloring_book_pdf_url_en &&
        el(
          "span",
          { style: { fontSize: "12px", color: "#50575e" } },
          meta._bitesmart_coloring_book_pdf_url_en.split("/").pop(),
        ),
    ),

    el(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" } },
      el(
        MediaUploadCheck,
        null,
        el(MediaUpload, {
          onSelect: (media) => updateMeta("_bitesmart_coloring_book_pdf_url_es", media.url),
          allowedTypes: ["application/pdf"],
          value: meta._bitesmart_coloring_book_pdf_url_es,
          render: ({ open }) =>
            el(
              Button,
              { onClick: open, variant: "secondary" },
              meta._bitesmart_coloring_book_pdf_url_es
                ? __("Replace Spanish PDF", "custom-blocks")
                : __("Upload Spanish PDF", "custom-blocks"),
            ),
        }),
      ),
      meta._bitesmart_coloring_book_pdf_url_es &&
        el(
          "span",
          { style: { fontSize: "12px", color: "#50575e" } },
          meta._bitesmart_coloring_book_pdf_url_es.split("/").pop(),
        ),
    ),
    el(
      "p",
      { className: "coloring-book-fields-hint" },
      __(
        "Leave a language blank to show a “Coming Soon” state for it instead of a Download button.",
        "custom-blocks",
      ),
    ),
  );
}

registerBlockType("custom/coloring-book-fields", {
  edit: ColoringBookFieldsEdit,
  save: () => null,
});
