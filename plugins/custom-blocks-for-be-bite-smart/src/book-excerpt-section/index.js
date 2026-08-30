import { registerBlockType } from "@wordpress/blocks";
import { createElement as el } from "@wordpress/element";
import { useBlockProps, InnerBlocks } from "@wordpress/block-editor";
import { __ } from "@wordpress/i18n";

// The second of custom/book-fields' two locked child sections — see
// custom/book-summary-section's own index.js header for the full "why" of
// this 3-level nesting. Wraps its InnerBlocks content in
// <blockquote class="wp-block-quote book-card-excerpt"> in BOTH edit() and
// save() (so the editor preview matches the front end exactly) — reusing
// the theme's existing accent-colored-left-border blockquote styling
// (twentytwentyfive-child/style.css), same visual treatment a real
// core/quote block gave this content earlier the same day (see
// [[be-bitesmart-book-cpt-status]] in memory) before this redesign.

const ALLOWED_BLOCKS = ["core/paragraph", "core/list"];

registerBlockType("custom/book-excerpt-section", {
  edit: () => {
    const blockProps = useBlockProps();

    return el(
      "div",
      blockProps,
      el("h3", { className: "book-card-section-heading" }, __("Book Excerpt", "custom-blocks")),
      el(
        "p",
        { className: "book-fields-hint" },
        __(
          "The book's own description, or a quote about it. Add paragraphs and/or a bulleted list, in any order.",
          "custom-blocks",
        ),
      ),
      el(
        "blockquote",
        { className: "wp-block-quote book-card-excerpt" },
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
      el("h3", { className: "book-card-section-heading" }, __("Book Excerpt", "custom-blocks")),
      el("blockquote", { className: "wp-block-quote book-card-excerpt" }, el(InnerBlocks.Content)),
    );
  },
});
