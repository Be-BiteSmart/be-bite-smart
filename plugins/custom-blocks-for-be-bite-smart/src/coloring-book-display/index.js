import { registerBlockType } from "@wordpress/blocks";
import { createElement as el } from "@wordpress/element";
import { useBlockProps } from "@wordpress/block-editor";
import { useSelect } from "@wordpress/data";
import { ComboboxControl, Placeholder } from "@wordpress/components";
import ServerSideRender from "@wordpress/server-side-render";
import { __ } from "@wordpress/i18n";

// This block stores nothing of its own beyond which Coloring Book post to
// show — see coloring-book-display.php's render_coloring_book_block() for
// where the actual content comes from. Mirrors custom/resource
// (src/resource-display/index.js). Most pages should use
// custom/coloring-books-list instead, so new coloring books show up
// automatically — this one's for the rare case of placing a single
// specific coloring book somewhere by hand.

function ColoringBookEdit({ attributes, setAttributes }) {
  const blockProps = useBlockProps();

  const coloringBooks = useSelect(
    (select) =>
      select("core").getEntityRecords("postType", "coloring_book", {
        per_page: -1,
        status: "any", // lets an editor pick an in-progress draft coloring book
        orderby: "title",
        order: "asc",
      }),
    [],
  );

  const options = (coloringBooks || []).map((coloringBook) => ({
    value: coloringBook.id,
    label:
      (coloringBook.title?.rendered || __("(untitled)", "custom-blocks")) +
      (coloringBook.status !== "publish" ? ` (${coloringBook.status})` : ""),
  }));

  return el(
    "div",
    blockProps,

    el(
      Placeholder,
      { icon: "art", label: __("Coloring Book", "custom-blocks") },
      el(ComboboxControl, {
        label: __("Choose a Coloring Book", "custom-blocks"),
        value: attributes.coloringBookId,
        options,
        onChange: (value) =>
          setAttributes({ coloringBookId: value ? Number(value) : undefined }),
      }),
    ),

    attributes.coloringBookId &&
      el(ServerSideRender, {
        block: "custom/coloring-book",
        attributes,
      }),
  );
}

registerBlockType("custom/coloring-book", {
  edit: ColoringBookEdit,
  save: () => null, // fully dynamic — see render_coloring_book_block() in coloring-book-display.php
});
