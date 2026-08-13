import "./style.css";

import { registerBlockType } from "@wordpress/blocks";
import { createElement as el } from "@wordpress/element";
import { useBlockProps } from "@wordpress/block-editor";
import { useSelect } from "@wordpress/data";
import { ComboboxControl, Placeholder } from "@wordpress/components";
import ServerSideRender from "@wordpress/server-side-render";
import { __ } from "@wordpress/i18n";

// This block stores nothing of its own beyond which Episode post to show —
// see episode-display.php's render_episode_block() for where the actual
// content comes from. That's what makes this the CPT-backed replacement
// for custom/episode-card, which is left untouched (see src/episode-card/).

function EpisodeEdit({ attributes, setAttributes }) {
  const blockProps = useBlockProps();

  const episodes = useSelect(
    (select) =>
      select("core").getEntityRecords("postType", "episode", {
        per_page: -1,
        status: "any", // lets an editor pick an in-progress draft episode
        orderby: "title",
        order: "asc",
      }),
    [],
  );

  const options = (episodes || []).map((episode) => ({
    value: episode.id,
    label:
      (episode.title?.rendered || __("(untitled)", "custom-blocks")) +
      (episode.status !== "publish" ? ` (${episode.status})` : ""),
  }));

  return el(
    "div",
    blockProps,

    el(
      Placeholder,
      { icon: "video-alt2", label: __("Episode", "custom-blocks") },
      el(ComboboxControl, {
        label: __("Choose an Episode", "custom-blocks"),
        value: attributes.episodeId,
        options,
        onChange: (value) =>
          setAttributes({ episodeId: value ? Number(value) : undefined }),
      }),
    ),

    attributes.episodeId &&
      el(ServerSideRender, {
        block: "custom/episode",
        attributes,
      }),
  );
}

registerBlockType("custom/episode", {
  edit: EpisodeEdit,
  save: () => null, // fully dynamic — see render_episode_block() in episode-display.php
});
