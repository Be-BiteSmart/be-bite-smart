import { registerBlockType } from "@wordpress/blocks";
import { createElement as el, useEffect } from "@wordpress/element";
import { useBlockProps } from "@wordpress/block-editor";
import { useEntityProp } from "@wordpress/core-data";
import { useDispatch, select as dataSelect } from "@wordpress/data";
import { TextareaControl } from "@wordpress/components";
import { __ } from "@wordpress/i18n";

// This block IS the Guide edit screen's main content — locked into place
// via the 'template' + template_lock: 'all' args on the guide CPT,
// registered in the separate Custom Post Types for BBS plugin (see its
// includes/guide-cpt.php; this plugin depends on that one being active —
// see this plugin's "Requires Plugins" header). Mirrors
// custom/episode-fields/custom/resource-fields (see episode-fields/index.js
// for the full rationale — locked canvas over a sidebar panel, save()
// returns null since everything here is post meta via useEntityProp).
//
// Deliberately the SHORTEST fields block in this plugin: unlike every other
// content type, a Guide's own fields are just Description — no per-language
// anything (Video/Keywords live on each CHAPTER instead, in
// custom/guide-chapter-panel, since chapters are their own posts — see
// [[be-bitesmart-guide-cpt-plan]] in memory). Chapters themselves are never
// added/ordered here; they're managed from their own "All Chapters" admin
// list (nested under Guides), each one picking its parent Guide from its
// own sidebar panel.

// Featured Image is the one field that stays in the native sidebar (same
// reasoning/mechanism as episode-fields — see that file) — auto-opened on
// mount so there's nothing to discover.
const NATIVE_PANELS_TO_AUTO_OPEN = ["featured-image"];

function GuideFieldsEdit() {
  const blockProps = useBlockProps({ className: "guide-fields-editor" });

  const { toggleEditorPanelOpened } = useDispatch("core/editor");
  useEffect(() => {
    NATIVE_PANELS_TO_AUTO_OPEN.forEach((panelName) => {
      if (!dataSelect("core/editor").isEditorPanelOpened(panelName)) {
        toggleEditorPanelOpened(panelName);
      }
    });
    // Intentionally run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // meta can briefly be undefined on the very first render, before the
  // post's entity record resolves in the data store — default to {} so the
  // field below doesn't throw and take the block down with it.
  const [meta = {}, setMeta] = useEntityProp("postType", "guide", "meta");

  const updateMeta = (key, value) => setMeta({ ...meta, [key]: value });

  return el(
    "div",
    blockProps,

    el("h2", { className: "guide-fields-heading" }, __("Guide Details", "custom-blocks")),
    el(
      "p",
      { className: "guide-fields-hint" },
      __(
        "The guide's title goes in the “Add title” field above, and its thumbnail comes from the “Featured Image” panel in the sidebar (already opened for you). This guide's chapters are added and ordered separately — see “All Chapters” under Guides in the admin menu, where each chapter picks this guide as its parent.",
        "custom-blocks",
      ),
    ),

    el(TextareaControl, {
      label: __("Description", "custom-blocks"),
      value: meta._bitesmart_guide_description || "",
      onChange: (val) => updateMeta("_bitesmart_guide_description", val),
      placeholder: __("Short summary shown wherever this guide is listed.", "custom-blocks"),
    }),
  );
}

registerBlockType("custom/guide-fields", {
  edit: GuideFieldsEdit,
  save: () => null,
});
