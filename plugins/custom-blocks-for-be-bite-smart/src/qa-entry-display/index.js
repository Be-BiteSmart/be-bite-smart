import "./style.css";

import { registerBlockType } from "@wordpress/blocks";
import { createElement as el } from "@wordpress/element";
import { useBlockProps } from "@wordpress/block-editor";
import { useSelect } from "@wordpress/data";
import { ComboboxControl, Placeholder } from "@wordpress/components";
import ServerSideRender from "@wordpress/server-side-render";
import { __ } from "@wordpress/i18n";

// This block stores nothing of its own beyond which Q&A Entry post to show —
// see qa-entry-display.php's render_qa_entry_block() for where the actual
// content comes from. Mirrors custom/episode and custom/resource
// (src/episode-display/index.js, src/resource-display/index.js).

function QaEntryEdit({ attributes, setAttributes }) {
  const blockProps = useBlockProps();

  const entries = useSelect(
    (select) =>
      select("core").getEntityRecords("postType", "qa_entry", {
        per_page: -1,
        status: "any", // lets an editor pick an in-progress draft entry
        orderby: "title",
        order: "asc",
      }),
    [],
  );

  const options = (entries || []).map((entry) => ({
    value: entry.id,
    label:
      (entry.title?.rendered || __("(untitled)", "custom-blocks")) +
      (entry.status !== "publish" ? ` (${entry.status})` : ""),
  }));

  return el(
    "div",
    blockProps,

    el(
      Placeholder,
      { icon: "editor-help", label: __("Q&A Entry", "custom-blocks") },
      el(ComboboxControl, {
        label: __("Choose a Q&A Entry", "custom-blocks"),
        value: attributes.entryId,
        options,
        onChange: (value) =>
          setAttributes({ entryId: value ? Number(value) : undefined }),
      }),
    ),

    attributes.entryId &&
      el(ServerSideRender, {
        block: "custom/qa-entry",
        attributes,
      }),
  );
}

registerBlockType("custom/qa-entry", {
  edit: QaEntryEdit,
  save: () => null, // fully dynamic — see render_qa_entry_block() in qa-entry-display.php
});
