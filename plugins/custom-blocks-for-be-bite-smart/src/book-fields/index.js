import { registerBlockType } from "@wordpress/blocks";
import { createElement as el } from "@wordpress/element";
import { useBlockProps, InnerBlocks } from "@wordpress/block-editor";
import { __ } from "@wordpress/i18n";

// This block IS the Book edit screen's main content area — locked into
// place via the 'template' + template_lock: 'all' args on the `book` CPT
// (see book-cpt.php in the Custom Post Types for BBS plugin), mirroring
// custom/qa-entry-fields/custom/resource-fields at THIS level.
//
// Redesigned twice on 2026-08-30 — full history in
// [[be-bitesmart-book-cpt-status]] in memory. Short version: first became a
// meta-field-based block (two RichText fields, BBS Summary/Book Excerpt),
// but real content needs a bulleted list sitting in the MIDDLE of a
// paragraph (e.g. "How to Speak Dog": intro sentence, list, closing
// sentence) — no flat meta value can represent that, and RichText's
// `multiline` mode (the obvious fix) failed silently, twice.
//
// Landed here: this block's OWN InnerBlocks area is locked
// (templateLock: 'all') to exactly two children, in this fixed order —
// custom/book-summary-section, custom/book-excerpt-section — neither
// removable nor reorderable. EACH of those two has its own FURTHER-nested
// InnerBlocks area that's genuinely free (Paragraph/List, any mix, any
// order) — see either section block's own index.js for that level. Same
// per-level templateLock nesting Core's own Columns/Column block uses.
// post_content is used again (each section's real block content
// serializes here — InnerBlocks content can only ever go into its parent
// block's own save() output, there's no way to redirect it into a meta
// field) — extracted back out by render_book_block() (book-display.php)
// via parse_blocks()/render_block(), the same mechanism already proven
// during this project's earlier post_content migrations.
//
// Audience, Price/Availability, Buy/More Info URL, and the "Inside the
// Book" preview-image picker stay in the existing custom/book-panel
// sidebar panel — this restructuring is scoped to just the two write-up
// sections, not a full migration of every Book field into this locked
// canvas the way Q&A Entry has everything in its one fields block.

registerBlockType("custom/book-fields", {
  edit: () => {
    const blockProps = useBlockProps();

    return el(
      "div",
      blockProps,
      el(
        "p",
        { className: "book-fields-hint" },
        __(
          "The book title goes in the “Add title” field above. Audience, Price/Availability, Buy/More Info URL, and Inside-the-Book preview images are all in the sidebar panel.",
          "custom-blocks",
        ),
      ),
      el(InnerBlocks, {
        template: [["custom/book-summary-section"], ["custom/book-excerpt-section"]],
        templateLock: "all",
      }),
    );
  },

  save: () => {
    const blockProps = useBlockProps.save();
    return el("div", blockProps, el(InnerBlocks.Content));
  },
});
