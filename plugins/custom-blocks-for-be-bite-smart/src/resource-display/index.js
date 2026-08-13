import "./style.css";

import { registerBlockType } from "@wordpress/blocks";
import { createElement as el } from "@wordpress/element";
import { useBlockProps } from "@wordpress/block-editor";
import { useSelect } from "@wordpress/data";
import { ComboboxControl, Placeholder } from "@wordpress/components";
import ServerSideRender from "@wordpress/server-side-render";
import { __ } from "@wordpress/i18n";

// This block stores nothing of its own beyond which Resource post to show —
// see resource-display.php's render_resource_block() for where the actual
// content comes from. Mirrors custom/episode (src/episode-display/index.js).

function ResourceEdit({ attributes, setAttributes }) {
  const blockProps = useBlockProps();

  const resources = useSelect(
    (select) =>
      select("core").getEntityRecords("postType", "resource", {
        per_page: -1,
        status: "any", // lets an editor pick an in-progress draft resource
        orderby: "title",
        order: "asc",
      }),
    [],
  );

  const options = (resources || []).map((resource) => ({
    value: resource.id,
    label:
      (resource.title?.rendered || __("(untitled)", "custom-blocks")) +
      (resource.status !== "publish" ? ` (${resource.status})` : ""),
  }));

  return el(
    "div",
    blockProps,

    el(
      Placeholder,
      { icon: "media-document", label: __("Resource", "custom-blocks") },
      el(ComboboxControl, {
        label: __("Choose a Resource", "custom-blocks"),
        value: attributes.resourceId,
        options,
        onChange: (value) =>
          setAttributes({ resourceId: value ? Number(value) : undefined }),
      }),
    ),

    attributes.resourceId &&
      el(ServerSideRender, {
        block: "custom/resource",
        attributes,
      }),
  );
}

registerBlockType("custom/resource", {
  edit: ResourceEdit,
  save: () => null, // fully dynamic — see render_resource_block() in resource-display.php
});
