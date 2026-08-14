import { registerBlockType } from "@wordpress/blocks";
import { createElement as el } from "@wordpress/element";
import { useBlockProps } from "@wordpress/block-editor";
import ServerSideRender from "@wordpress/server-side-render";
import { __ } from "@wordpress/i18n";

// No attributes: this block always shows every published Coloring Book —
// see render_coloring_books_list_block() in coloring-books-list.php. That's
// the whole point (Janet's 2026-08-13 requirement, see
// [[be-bitesmart-downloads-planning]] in memory): a new Coloring Book post
// appears here automatically, with no per-entry block to place by hand.

function ColoringBooksListEdit() {
  const blockProps = useBlockProps();

  return el(
    "div",
    blockProps,
    el(
      "p",
      {
        style: {
          fontSize: "12px",
          color: "#50575e",
          margin: "0 0 8px",
          fontStyle: "italic",
        },
      },
      __(
        "Auto-lists every published Coloring Book below — nothing to configure here.",
        "custom-blocks",
      ),
    ),
    el(ServerSideRender, { block: "custom/coloring-books-list" }),
  );
}

registerBlockType("custom/coloring-books-list", {
  edit: ColoringBooksListEdit,
  save: () => null, // fully dynamic — see render_coloring_books_list_block() in coloring-books-list.php
});
