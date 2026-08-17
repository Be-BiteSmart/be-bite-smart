import { registerBlockType } from "@wordpress/blocks";
import { createElement as el } from "@wordpress/element";
import { useBlockProps } from "@wordpress/block-editor";
import ServerSideRender from "@wordpress/server-side-render";

// No guideId attribute/picker (removed 2026-08-16 — see block.json) — per
// Janet: "we only ever have the one guide, so this dropdown is
// unnecessary." render_guide_description_block() (guide-description.php)
// resolves that one Guide itself via bitesmart_get_the_main_guide()
// (guide-cpt.php), same "there's only ever one, don't make anyone pick"
// pattern already used for a chapter's own parent-Guide relationship (see
// guide-chapter-panel/index.js's own header comment for that precedent) —
// this block was the odd one out still asking an editor to choose from a
// list with exactly one option in it.

function GuideDescriptionEdit() {
  const blockProps = useBlockProps();

  return el(
    "div",
    blockProps,
    el(ServerSideRender, { block: "custom/guide-description", attributes: {} }),
  );
}

registerBlockType("custom/guide-description", {
  edit: GuideDescriptionEdit,
  save: () => null, // fully dynamic — see render_guide_description_block() in guide-description.php
});
