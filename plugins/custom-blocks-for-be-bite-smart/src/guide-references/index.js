import "./style.css";
import { registerBlockType } from "@wordpress/blocks";
import { createElement as el } from "@wordpress/element";
import { useBlockProps } from "@wordpress/block-editor";
import ServerSideRender from "@wordpress/server-side-render";

// Same "stores nothing but which post to show" shape as custom/guide-single/
// custom/guide-description — see either's own header comment. No
// guideId attribute/picker at all, learned from those two blocks' own
// 2026-08-16 simplification earlier this session ("we only ever have the
// one guide, so this dropdown is unnecessary") — built without one from
// the start here rather than adding it and then having to remove it again.
// render_guide_references_block() (guide-references.php) resolves the
// site's one Guide itself via bitesmart_get_the_main_guide() (guide-cpt.php).

function GuideReferencesEdit() {
  const blockProps = useBlockProps();

  return el(
    "div",
    blockProps,
    el(ServerSideRender, { block: "custom/guide-references", attributes: {} }),
  );
}

registerBlockType("custom/guide-references", {
  edit: GuideReferencesEdit,
  save: () => null, // fully dynamic — see render_guide_references_block() in guide-references.php
});
