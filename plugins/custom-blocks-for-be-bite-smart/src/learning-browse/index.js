import "./style.css";

import { registerBlockType } from "@wordpress/blocks";
import { createElement as el } from "@wordpress/element";
import { useBlockProps } from "@wordpress/block-editor";
import { useSelect } from "@wordpress/data";
import { Placeholder, SelectControl, Spinner } from "@wordpress/components";
import { __ } from "@wordpress/i18n";

// Sibling of custom/learning-search (learning-search/index.js), split out
// 2026-08-16 — see learning-search.php's file-level comment for the full
// "why". Same editor UI shape deliberately duplicated rather than shared:
// this codebase's own convention is small per-block editor UI stays local
// (the same Stage-picker Placeholder+SelectControl pattern is already
// independently repeated in coloring-book-display, episode-display,
// guide-single, qa-entry-display, qa-entry-fields, resource-display, and
// learning-search itself — no shared component exists for it anywhere).
//
// Stores only which Stage it's for; everything it shows (the type-filter
// checkboxes, the paginated browse list) is built server-side at render
// time from that Stage's card list — see learning-browse.php's
// render_learning_browse_block(). There's nothing meaningful for
// ServerSideRender to preview here (the real behavior is a mix of PHP
// pagination and a front-end script), so the editor just shows which
// Stage is selected — same as learning-search's own editor UI.

function LearningBrowseEdit({ attributes, setAttributes }) {
  const blockProps = useBlockProps();

  const { stageTerms, isLoading } = useSelect((select) => {
    const query = select("core").getEntityRecords("taxonomy", "stage", { per_page: -1 });
    return {
      stageTerms: query || [],
      isLoading: query === null,
    };
  }, []);

  const options = [
    { label: __("— Select a Stage —", "custom-blocks"), value: "" },
    ...stageTerms.map((term) => ({ label: term.name, value: term.slug })),
  ];

  return el(
    "div",
    blockProps,
    el(
      Placeholder,
      {
        icon: "list-view",
        label: __("Learning Hub Browse", "custom-blocks"),
        instructions: __(
          "Shows the type-filter checkboxes and a persistent, paginated browse list of everything tagged with the Stage chosen below. Place alongside a Learning Hub Search block set to the same Stage.",
          "custom-blocks",
        ),
      },
      isLoading
        ? el(Spinner)
        : el(SelectControl, {
            label: __("Stage", "custom-blocks"),
            value: attributes.stageSlug,
            options,
            onChange: (value) => setAttributes({ stageSlug: value }),
          }),
      attributes.stageSlug &&
        el(
          "p",
          { className: "learning-search-editor-note" },
          __("The browse list renders on the front end.", "custom-blocks"),
        ),
    ),
  );
}

registerBlockType("custom/learning-browse", {
  edit: LearningBrowseEdit,
  save: () => null, // fully dynamic — see render_learning_browse_block() in learning-browse.php
});
