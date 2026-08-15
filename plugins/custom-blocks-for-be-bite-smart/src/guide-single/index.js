import { registerBlockType } from "@wordpress/blocks";
import { createElement as el } from "@wordpress/element";
import { useBlockProps } from "@wordpress/block-editor";
import { useSelect } from "@wordpress/data";
import { ComboboxControl, Placeholder } from "@wordpress/components";
import ServerSideRender from "@wordpress/server-side-render";
import { __ } from "@wordpress/i18n";

// Same "stores nothing but which post to show" shape as custom/episode
// (episode-display/index.js) — see that file's comment. Added specifically
// so a Guide can be shown at a URL an editor picks (e.g. a Page with slug
// exactly "guide", giving a clean /guide/ URL for THE main guide) rather
// than only at the Guide CPT's own /guide/<slug>/ permalink — see
// [[be-bitesmart-guide-cpt-plan]] in memory.

function GuideSingleEdit({ attributes, setAttributes }) {
  const blockProps = useBlockProps();

  const guides = useSelect(
    (select) =>
      select("core").getEntityRecords("postType", "guide", {
        per_page: -1,
        status: "any", // lets an editor pick an in-progress draft guide
        orderby: "title",
        order: "asc",
      }),
    [],
  );

  const options = (guides || []).map((guide) => ({
    value: guide.id,
    label:
      (guide.title?.rendered || __("(untitled)", "custom-blocks")) +
      (guide.status !== "publish" ? ` (${guide.status})` : ""),
  }));

  return el(
    "div",
    blockProps,

    el(
      Placeholder,
      { icon: "book-alt", label: __("Guide", "custom-blocks") },
      el(ComboboxControl, {
        label: __("Choose a Guide", "custom-blocks"),
        value: attributes.guideId,
        options,
        onChange: (value) =>
          setAttributes({ guideId: value ? Number(value) : undefined }),
      }),
    ),

    attributes.guideId &&
      el(ServerSideRender, {
        block: "custom/guide-single",
        attributes,
      }),
  );
}

registerBlockType("custom/guide-single", {
  edit: GuideSingleEdit,
  save: () => null, // fully dynamic — see render_guide_single_block() in guide-single.php
});
