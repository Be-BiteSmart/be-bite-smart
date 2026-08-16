import { registerBlockType } from "@wordpress/blocks";
import { createElement as el, useEffect } from "@wordpress/element";
import { useBlockProps, MediaUpload, MediaUploadCheck } from "@wordpress/block-editor";
import { useEntityProp } from "@wordpress/core-data";
import { useDispatch, select as dataSelect } from "@wordpress/data";
import { TextareaControl, Button } from "@wordpress/components";
import { __ } from "@wordpress/i18n";
import { getSiteLanguages } from "../shared/languages";

// This block IS the Guide edit screen's main content — locked into place
// via the 'template' + template_lock: 'all' args on the guide CPT,
// registered in the separate Custom Post Types for BBS plugin (see its
// includes/guide-cpt.php; this plugin depends on that one being active —
// see this plugin's "Requires Plugins" header). Mirrors
// custom/episode-fields/custom/resource-fields (see episode-fields/index.js
// for the full rationale — locked canvas over a sidebar panel, save()
// returns null since everything here is post meta via useEntityProp).
//
// Deliberately one of the SHORTEST fields blocks in this plugin: unlike
// every other content type, a Guide's own fields are just Description +
// the downloadable PDF below — Video/Keywords still live on each CHAPTER
// instead, in custom/guide-chapter-panel, since chapters are their own
// posts (see [[be-bitesmart-guide-cpt-plan]] in memory). Chapters
// themselves are never added/ordered here; they're managed from their own
// "All Chapters" admin list (nested under Guides), each one picking this
// guide as its parent from its own sidebar panel.
//
// Downloadable PDF (added 2026-08-16, moved here FROM guide-chapter-panel's
// own per-chapter field the same day): Janet decided the source PDF
// realistically can't be split into separate per-chapter files, so there's
// now exactly one upload location for it — here, on the Guide itself —
// and every chapter's Download button (bitesmart_render_guide_chapter_row(),
// guide-chapter-display.php) reads this SAME _bitesmart_guide_pdf_by_lang
// meta via its parent Guide. Same per-language MediaUpload row shape the
// chapter panel used to have.
//
// A "Usage Rights, Permissions & Attribution" field briefly lived here too
// (2026-08-16) — removed the same day once Janet flagged the real text
// needs richer formatting (lists, weblinks) than a plain TextareaControl
// can hold. That content now lives as real Gutenberg blocks on the site's
// existing /legal/ Page instead, and each chapter links straight to it —
// see bitesmart_render_guide_chapter_row()'s own comment
// (guide-chapter-display.php).

// Featured Image is the one field that stays in the native sidebar (same
// reasoning/mechanism as episode-fields — see that file) — auto-opened on
// mount so there's nothing to discover.
const NATIVE_PANELS_TO_AUTO_OPEN = ["featured-image"];

function GuideFieldsEdit() {
  const blockProps = useBlockProps({ className: "guide-fields-editor" });

  const { toggleEditorPanelOpened } = useDispatch("core/editor");
  useEffect(() => {
    NATIVE_PANELS_TO_AUTO_OPEN.forEach((panelName) => {
      if (!dataSelect("core/editor").isEditorPanelOpened(panelName)) {
        toggleEditorPanelOpened(panelName);
      }
    });
    // Intentionally run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // meta can briefly be undefined on the very first render, before the
  // post's entity record resolves in the data store — default to {} so the
  // field below doesn't throw and take the block down with it.
  const [meta = {}, setMeta] = useEntityProp("postType", "guide", "meta");
  const languages = getSiteLanguages();
  const pdfs = meta._bitesmart_guide_pdf_by_lang || {};

  const updateMeta = (key, value) => setMeta({ ...meta, [key]: value });
  const setPdfUrl = (code, url) => updateMeta("_bitesmart_guide_pdf_by_lang", { ...pdfs, [code]: url });

  return el(
    "div",
    blockProps,

    el("h2", { className: "guide-fields-heading" }, __("Guide Details", "custom-blocks")),
    el(
      "p",
      { className: "guide-fields-hint" },
      __(
        "The guide's title goes in the “Add title” field above, and its thumbnail comes from the “Featured Image” panel in the sidebar (already opened for you). This guide's chapters are added and ordered separately — see “All Chapters” under Guides in the admin menu, where each chapter picks this guide as its parent.",
        "custom-blocks",
      ),
    ),

    el(TextareaControl, {
      label: __("Description", "custom-blocks"),
      value: meta._bitesmart_guide_description || "",
      onChange: (val) => updateMeta("_bitesmart_guide_description", val),
      placeholder: __("Short summary shown wherever this guide is listed.", "custom-blocks"),
    }),

    el("hr", { style: { margin: "16px 0" } }),

    el("p", { style: { fontWeight: 600, marginBottom: 4 } }, __("Downloadable PDF", "custom-blocks")),
    el(
      "p",
      { className: "components-base-control__help", style: { marginTop: 0 } },
      __(
        "Shown as a Download button at the bottom of every chapter, once expanded — one upload here covers the whole guide. Leave a language blank to skip its button.",
        "custom-blocks",
      ),
    ),
    // Key-prefixed even though this is the only languages.map() in this
    // block — matches the established convention in guide-chapter-panel/
    // index.js (see that file's own comment for the real key-collision bug
    // this prefixing avoids once a second languages.map() group exists).
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
  );
}

registerBlockType("custom/guide-fields", {
  edit: GuideFieldsEdit,
  save: () => null,
});
