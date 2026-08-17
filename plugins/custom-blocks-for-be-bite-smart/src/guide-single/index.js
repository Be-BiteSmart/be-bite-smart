import { registerBlockType } from "@wordpress/blocks";
import { createElement as el } from "@wordpress/element";
import { useBlockProps } from "@wordpress/block-editor";
import ServerSideRender from "@wordpress/server-side-render";

// No guideId attribute/picker (removed 2026-08-16 — see block.json) — per
// Janet: "we only ever have the one guide, so this dropdown is
// unnecessary." render_guide_single_block() (guide-single.php) resolves
// that one Guide itself via bitesmart_get_the_main_guide() (guide-cpt.php),
// same "there's only ever one, don't make anyone pick" pattern already
// used for a chapter's own parent-Guide relationship (see
// guide-chapter-panel/index.js's own header comment for that precedent).
// Still lets an editor place this block at a URL of their choosing (any
// Page, any slug — Janet actually placed THE main guide at
// /learning/guide/, not a site-root /guide/ Page) — just without a
// picker, since there was never a real choice behind it (see
// [[be-bitesmart-guide-cpt-plan]] in memory).

function GuideSingleEdit() {
  const blockProps = useBlockProps();

  return el(
    "div",
    blockProps,
    el(ServerSideRender, { block: "custom/guide-single", attributes: {} }),
  );
}

registerBlockType("custom/guide-single", {
  edit: GuideSingleEdit,
  save: () => null, // fully dynamic — see render_guide_single_block() in guide-single.php
});
