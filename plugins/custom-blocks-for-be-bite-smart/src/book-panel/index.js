import { registerPlugin } from "@wordpress/plugins";
import { PluginDocumentSettingPanel } from "@wordpress/editor";
import { createElement as el, useEffect } from "@wordpress/element";
import { useEntityProp } from "@wordpress/core-data";
import { useDispatch, select as dataSelect } from "@wordpress/data";
import { TextControl, RadioControl } from "@wordpress/components";
import { __ } from "@wordpress/i18n";
import { getSiteLanguages } from "../shared/languages";

// UNLIKE every *-fields block in this plugin (episode-fields,
// resource-fields, qa-entry-fields, coloring-book-fields, guide-fields),
// this is NOT a locked-canvas block — it's a PluginDocumentSettingPanel, a
// sidebar panel. book's editor canvas is deliberately left UNLOCKED (see
// book-cpt.php): post_content IS the book's "why we recommend it" body,
// authored with the normal block editor (restricted to Paragraph/List — see
// bitesmart_restrict_book_allowed_blocks() there), so there's no room for a
// canvas-filling fields block here — everything that ISN'T that body lives
// in this sidebar panel instead. Its script is enqueued only on the book
// edit screen (see bitesmart_enqueue_book_panel() in this plugin's
// book-panel.php), not registered as a block at all — no block.json next to
// this file, same as guide-chapter-panel.

// Featured Image is the one native field that stays in the sidebar —
// collapsed by default, easy to miss, so this opens it automatically on
// mount rather than relying on hint text alone. Same pattern as
// episode-fields/index.js and guide-fields/index.js. Runs once; doesn't
// fight an editor who closes it afterward.
const NATIVE_PANELS_TO_AUTO_OPEN = ["featured-image"];

function BookPanel() {
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
  // fields below don't throw and take the panel down with them.
  const [meta = {}, setMeta] = useEntityProp("postType", "book", "meta");
  const languages = getSiteLanguages();
  const keywords = meta._bitesmart_book_keywords_by_lang || {};

  const updateMeta = (key, value) => setMeta({ ...meta, [key]: value });
  const setKeywords = (code, text) =>
    updateMeta("_bitesmart_book_keywords_by_lang", { ...keywords, [code]: text });

  return el(
    PluginDocumentSettingPanel,
    {
      name: "book-details",
      title: __("Book Details", "custom-blocks"),
      initialOpen: true,
    },

    el(
      "p",
      { className: "components-base-control__help", style: { marginTop: 0 } },
      __(
        "The cover image goes in Featured Image below. The “why we recommend it” text goes in the main canvas.",
        "custom-blocks",
      ),
    ),

    // Added 2026-08-16, per Janet: some book recommendations are kid-facing,
    // some are written for an adult reader — Stage alone doesn't capture
    // that (a book can suit every Stage the way general dog-body-language
    // knowledge is useful at any age). Deliberately just two options, not a
    // "kids/adults/both" multi-select — Janet's own framing: a kid-friendly
    // book is still fine for a parent to read too, so "For Readers of Any
    // Age" already covers the "works for both" case. Same RadioControl
    // two-value-toggle pattern as Q&A Entry's own Answer Type field (see
    // qa-entry-fields/index.js) — visual badge only on the front end (see
    // book-display.php), not wired into any search/browse filter.
    el(RadioControl, {
      label: __("Audience", "custom-blocks"),
      selected: meta._bitesmart_book_audience || "all_ages",
      options: [
        { label: __("For Readers of Any Age", "custom-blocks"), value: "all_ages" },
        { label: __("For Adult Readers", "custom-blocks"), value: "adult" },
      ],
      onChange: (val) => updateMeta("_bitesmart_book_audience", val),
    }),

    el(TextControl, {
      label: __("Price / Availability", "custom-blocks"),
      value: meta._bitesmart_book_price_availability || "",
      onChange: (val) => updateMeta("_bitesmart_book_price_availability", val),
      placeholder: __("e.g. $8.99 and widely available", "custom-blocks"),
    }),

    el(TextControl, {
      label: __("Buy / More Info URL", "custom-blocks"),
      value: meta._bitesmart_book_url || "",
      onChange: (val) => updateMeta("_bitesmart_book_url", val),
      placeholder: "https://...",
      help: __("Optional — leave blank if there's no single link to send parents to yet.", "custom-blocks"),
    }),

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
        key: lang.code,
        label: `${__("Keywords", "custom-blocks")} (${lang.name})`,
        value: keywords[lang.code] || "",
        onChange: (val) => setKeywords(lang.code, val),
        placeholder: __("e.g. body language, growling, dog behavior", "custom-blocks"),
      }),
    ),
  );
}

registerPlugin("book-panel", { render: BookPanel });
