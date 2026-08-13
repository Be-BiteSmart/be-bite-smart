import "./style.css";

import { registerBlockType } from "@wordpress/blocks";
import { createElement as el } from "@wordpress/element";
import { useBlockProps } from "@wordpress/block-editor";
import { useSelect } from "@wordpress/data";
import { Placeholder, SelectControl, Spinner } from "@wordpress/components";
import { __ } from "@wordpress/i18n";

// custom/learning-search is placed once per Stage archive page (e.g.
// /learning/stages/preschool/ — see [[be-bitesmart-content-hub-plan]] in
// memory). It stores only which Stage it's for; everything it shows (the
// search box, the paginated "all content" list) is built server-side at
// render time from that Stage's Q&A Entries + Resources — see
// learning-search.php's render_learning_search_block(). There's nothing
// meaningful for ServerSideRender to preview here (the real behavior is a
// mix of PHP pagination and a front-end Fuse.js search script), so the
// editor just shows which Stage is selected.

function LearningSearchEdit({ attributes, setAttributes }) {
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
        icon: "search",
        label: __("Learning Hub Search", "custom-blocks"),
        instructions: __(
          "Shows a search box plus a paginated list of every Q&A Entry and Resource tagged with the Stage chosen below. Place this once on each Stage archive page.",
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
          __("Search results and the browse list render on the front end.", "custom-blocks"),
        ),
    ),
  );
}

registerBlockType("custom/learning-search", {
  edit: LearningSearchEdit,
  save: () => null, // fully dynamic — see render_learning_search_block() in learning-search.php
});
