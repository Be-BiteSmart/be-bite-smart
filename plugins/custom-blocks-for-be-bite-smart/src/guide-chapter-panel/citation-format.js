import { registerFormatType, create, insert, applyFormat } from "@wordpress/rich-text";
import { RichTextToolbarButton } from "@wordpress/block-editor";
import { createElement as el, useState, Fragment } from "@wordpress/element";
import { useSelect } from "@wordpress/data";
import { Popover, ComboboxControl } from "@wordpress/components";
import { __ } from "@wordpress/i18n";

// "Cite" — an inline RichText format for referencing one of the Guide's
// Citation posts from within a chapter's own text, added 2026-08-16 per
// Janet's own pick (a custom "Insert Citation" tool over hand-typed markup
// — see [[be-bitesmart-guide-cpt-plan]] in memory).
//
// Imported into this folder's own index.js (NOT a separate webpack entry
// or PHP enqueue) so it piggybacks on that file's existing enqueue —
// bitesmart_enqueue_guide_chapter_panel() (guide-chapter-panel.php) only
// ever loads on the guide_chapter edit screen, which is exactly where this
// format should be available and nowhere else, even though
// registerFormatType() itself is technically a global WP mechanism.
//
// REVISED 2026-08-16 — the original version used insertObject() with a
// custom `innerHTML` property on the format-to-insert, on the (wrong)
// assumption that RichText's object-format model would render that as the
// object's visible content. It doesn't: `innerHTML` isn't a real property
// RichText's format model understands at all, so it was silently dropped
// both at edit-time render AND at save-time serialization — the SUP always
// came out completely empty, AND (worse) unclosed/malformed in the raw
// saved HTML (`<sup ...>` with no matching `</sup>`), which is what
// produced the very first "Block contains unexpected content" error Janet
// hit the moment she reopened a chapter that already had one inserted.
//
// Fixed by dropping insertObject()/`object: true` entirely and instead
// inserting REAL TEXT (the citation's current Number) at the cursor,
// wrapped in this format — the exact same low-level mechanism Bold/Italic
// use on a text selection, just synthesizing the "selection" ourselves
// (create() + applyFormat()) instead of requiring the editor to select
// text first. This always produces well-formed, round-trippable HTML:
//   <sup class="citation-ref-wrap" data-citation-id="123">14</sup>
// — genuinely closed, genuinely has visible content, both in the editor
// and in what gets saved.
//
// The visible "14" here is STILL only an editor-time preview/convenience —
// editing or even deleting the digit inside the sup has no effect on the
// real site: the actual live-resolved number, the href pointing at the
// References page, and the hover/focus tooltip data all get computed
// SERVER-SIDE at chapter-render time purely from data-citation-id — see
// bitesmart_resolve_citation_refs() (guide-chapter-display.php), which
// discards and rebuilds the sup's ENTIRE inner content fresh on every
// render regardless of what's actually saved inside it. That's what lets a
// later renumber of a citation in wp-admin update every chapter that
// already cites it, with nothing to re-save on the chapter side.

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

    // Build a small RichText value holding just the number, with our
    // format applied across all of it (applyFormat's start/end args are
    // offsets into the value being formatted, not the chapter's own
    // cursor position — 0 to number.length covers the whole thing), then
    // insert that at the chapter's actual current cursor position
    // (value.start/value.end — a collapsed cursor has start === end, same
    // as any other RichText insertion).
    const format = {
      type: FORMAT_NAME,
      attributes: {
        "data-citation-id": String(citationId),
      },
    };
    const toInsert = applyFormat(create({ text: String(number) }), format, 0, String(number).length);
    const newValue = insert(value, toInsert, value.start, value.end);
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
  // No `object: true` (see this file's header comment for why that was
  // wrong) — this is now a plain wrapping format, same shape as core's own
  // Bold/Italic, just applied to text we insert ourselves rather than an
  // existing selection.
  edit: CitationFormatEdit,
});
