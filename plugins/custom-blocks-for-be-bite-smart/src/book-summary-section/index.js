import { registerBlockType } from "@wordpress/blocks";
import { createElement as el } from "@wordpress/element";
import { useBlockProps, InnerBlocks } from "@wordpress/block-editor";
import { __ } from "@wordpress/i18n";

// The first of custom/book-fields' two locked child sections (see that
// block's own index.js header for the full "why" of this 3-level nesting —
// short version: real Paragraph/List editing, freely interleaved, needs
// actual nested blocks, not RichText). This section's own label ("Why BBS
// Recommends This Book" — renamed 2026-08-30 from "BBS Summary", Janet's
// ask) and position are fixed — an editor can't remove or reorder it —
// but its InnerBlocks area is fully free (add/remove/reorder Paragraph and
// List blocks in any mix). save()'s wrapper (.book-card-content) is the
// SAME class render_book_block() (book-display.php) already styled for this
// content — no new CSS needed.

const ALLOWED_BLOCKS = ["core/paragraph", "core/list"];

registerBlockType("custom/book-summary-section", {
  edit: () => {
    const blockProps = useBlockProps();

    return el(
      "div",
      blockProps,
      el("h3", { className: "book-card-section-heading" }, __("Why BBS Recommends This Book", "custom-blocks")),
      el(
        "p",
        { className: "book-fields-hint" },
        __(
          "Why BBS is recommending this book. Add paragraphs and/or a bulleted list, in any order.",
          "custom-blocks",
        ),
      ),
      el(
        "div",
        { className: "book-card-content" },
        el(InnerBlocks, {
          allowedBlocks: ALLOWED_BLOCKS,
          template: [["core/paragraph", {}]],
          templateLock: false,
        }),
      ),
    );
  },

  save: () => {
    const blockProps = useBlockProps.save();

    return el(
      "div",
      blockProps,
      el("h3", { className: "book-card-section-heading" }, __("Why BBS Recommends This Book", "custom-blocks")),
      el("div", { className: "book-card-content" }, el(InnerBlocks.Content)),
    );
  },
});
