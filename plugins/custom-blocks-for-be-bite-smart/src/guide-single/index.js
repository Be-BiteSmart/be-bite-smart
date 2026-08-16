import { registerBlockType } from "@wordpress/blocks";
import { createElement as el } from "@wordpress/element";
import { useBlockProps } from "@wordpress/block-editor";
import { useSelect } from "@wordpress/data";
import { ComboboxControl, Placeholder } from "@wordpress/components";
import ServerSideRender from "@wordpress/server-side-render";
import { __ } from "@wordpress/i18n";

// Same "stores nothing but which post to show" shape as custom/episode
// (episode-display/index.js) — see that file's comment. Added specifically
// so a Guide can be shown at a URL an editor picks (any Page, any slug —
// Janet actually placed THE main guide at /learning/guide/, not a
// site-root /guide/ Page) rather than only at the Guide CPT's own
// /learning/guide/<slug>/ permalink (chapters' own rewrite prefix was
// moved to match, 2026-08-16 — see guide-chapter-cpt.php) — see
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
