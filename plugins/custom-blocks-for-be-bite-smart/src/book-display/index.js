import "./style.css";

import { registerBlockType } from "@wordpress/blocks";
import { createElement as el } from "@wordpress/element";
import { useBlockProps } from "@wordpress/block-editor";
import { useSelect } from "@wordpress/data";
import { ComboboxControl, Placeholder } from "@wordpress/components";
import ServerSideRender from "@wordpress/server-side-render";
import { __ } from "@wordpress/i18n";

// This block stores nothing of its own beyond which Book post to show — see
// book-display.php's render_book_block() for where the actual content comes
// from. Mirrors custom/resource (src/resource-display/index.js).

function BookEdit({ attributes, setAttributes }) {
  const blockProps = useBlockProps();

  const books = useSelect(
    (select) =>
      select("core").getEntityRecords("postType", "book", {
        per_page: -1,
        status: "any", // lets an editor pick an in-progress draft book
        orderby: "title",
        order: "asc",
      }),
    [],
  );

  const options = (books || []).map((book) => ({
    value: book.id,
    label:
      (book.title?.rendered || __("(untitled)", "custom-blocks")) +
      (book.status !== "publish" ? ` (${book.status})` : ""),
  }));

  return el(
    "div",
    blockProps,

    el(
      Placeholder,
      { icon: "book", label: __("Book", "custom-blocks") },
      el(ComboboxControl, {
        label: __("Choose a Book", "custom-blocks"),
        value: attributes.bookId,
        options,
        onChange: (value) =>
          setAttributes({ bookId: value ? Number(value) : undefined }),
      }),
    ),

    attributes.bookId &&
      el(ServerSideRender, {
        block: "custom/book",
        attributes,
      }),
  );
}

registerBlockType("custom/book", {
  edit: BookEdit,
  save: () => null, // fully dynamic — see render_book_block() in book-display.php
});
