import { registerFormatType, insertObject } from "@wordpress/rich-text";
import { RichTextToolbarButton } from "@wordpress/block-editor";
import { createElement as el, useState, Fragment } from "@wordpress/element";
import { useSelect } from "@wordpress/data";
import { Popover, ComboboxControl } from "@wordpress/components";
import { __ } from "@wordpress/i18n";

// "Cite" — an inline RichText format for referencing one of the Guide's
// Citation posts from within a chapter's own text, added 2026-08-16 per
// Janet's own pick (a custom "Insert Citation" tool over hand-typed markup
// — see [[be-bitesmart-guide-cpt-plan]] in memory). Same general mechanism
// WordPress's own built-in Footnote format uses (@wordpress/format-library's
// core/footnote): registered via registerFormatType(), but inserted as a
// self-contained, non-editable inline OBJECT via insertObject() rather
// than wrapping a text selection — so an editor doesn't need to
// pre-select/type anything, just place the cursor at the exact point in
// the sentence and click "Cite."
//
// Imported into this folder's own index.js (NOT a separate webpack entry
// or PHP enqueue) so it piggybacks on that file's existing enqueue —
// bitesmart_enqueue_guide_chapter_panel() (guide-chapter-panel.php) only
// ever loads on the guide_chapter edit screen, which is exactly where this
// format should be available and nowhere else, even though
// registerFormatType() itself is technically a global WP mechanism.
//
// What actually gets inserted is deliberately minimal:
//   <sup class="citation-ref-wrap" data-citation-id="123">
//     <a href="#" class="citation-ref">14</a>
//   </sup>
// — the visible "14" and the placeholder href here are ONLY an editor-time
// preview. The real, live-resolved number, the href pointing at the
// References page, and the hover/focus tooltip data all get computed
// SERVER-SIDE at chapter-render time from data-citation-id — see
// bitesmart_resolve_citation_refs() (guide-chapter-display.php). That's
// what lets a later renumber of a citation in wp-admin update every
// chapter that already cites it, with nothing to re-save on the chapter
// side.

const FORMAT_NAME = "custom-blocks/citation-ref";

function citationLabel(citation) {
  const number = citation.meta?._bitesmart_citation_number || "?";
  const title = citation.title?.rendered || __("(untitled)", "custom-blocks");
  return `${number} — ${title}`;
}

function CitationFormatEdit({ value, onChange, isActive }) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const citations = useSelect(
    (select) =>
      select("core").getEntityRecords("postType", "citation", {
        per_page: -1,
        status: "publish",
      }),
    [],
  );

  // Sorted client-side by Citation Number rather than via a REST
  // `orderby=meta_value_num` query — the default REST Posts controller
  // only accepts a fixed whitelist of `orderby` values out of the box, and
  // extending that whitelist for this one field isn't worth the extra
  // server-side wiring just to save one small client-side sort.
  const sortedCitations = [...(citations || [])].sort((a, b) => {
    const numA = parseFloat(a.meta?._bitesmart_citation_number) || 0;
    const numB = parseFloat(b.meta?._bitesmart_citation_number) || 0;
    return numA - numB;
  });

  const options = sortedCitations.map((citation) => ({
    value: citation.id,
    label: citationLabel(citation),
  }));

  function insertCitation(citationId) {
    setIsPopoverOpen(false);
    if (!citationId) return;

    const citation = sortedCitations.find((c) => c.id === citationId);
    const number = citation?.meta?._bitesmart_citation_number || "?";

    const newValue = insertObject(value, {
      type: FORMAT_NAME,
      attributes: {
        "data-citation-id": String(citationId),
      },
      innerHTML: `<a href="#" class="citation-ref">${number}</a>`,
    });
    onChange(newValue);
  }

  return el(
    Fragment,
    null,
    el(RichTextToolbarButton, {
      icon: "editor-quote",
      title: __("Cite", "custom-blocks"),
      onClick: () => setIsPopoverOpen(true),
      isActive,
    }),
    isPopoverOpen &&
      el(
        Popover,
        { onClose: () => setIsPopoverOpen(false) },
        el(
          "div",
          { style: { padding: "16px", minWidth: "280px" } },
          el(ComboboxControl, {
            label: __("Choose a citation", "custom-blocks"),
            value: null,
            options,
            onChange: insertCitation,
            help:
              options.length === 0
                ? __("No published Citations yet — add some under Parent Guide → All Citations.", "custom-blocks")
                : undefined,
          }),
        ),
      ),
  );
}

registerFormatType(FORMAT_NAME, {
  title: __("Citation", "custom-blocks"),
  tagName: "sup",
  className: "citation-ref-wrap",
  attributes: {
    citationId: "data-citation-id",
  },
  // Required for insertObject() (used in insertCitation() above) to
  // actually render — without this, RichText's edit-time display doesn't
  // know this format represents a self-contained object with its own
  // innerHTML (the visible superscript number), so nothing shows in the
  // editor even though the raw <sup><a>14</a></sup> markup is still
  // written to post_content correctly (which is why the number rendered
  // fine on the front end all along — that's just parsing the saved HTML,
  // untouched by this bug). Same flag core's own Footnote format
  // (core/footnote, @wordpress/format-library) sets for the same reason.
  object: true,
  edit: CitationFormatEdit,
});
