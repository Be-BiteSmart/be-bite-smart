import { registerBlockType } from "@wordpress/blocks";
import { createElement as el, useEffect } from "@wordpress/element";
import { useBlockProps } from "@wordpress/block-editor";
import { useEntityProp } from "@wordpress/core-data";
import { useDispatch, select as dataSelect } from "@wordpress/data";
import { TextControl, TextareaControl, Button } from "@wordpress/components";
import { MediaUpload, MediaUploadCheck } from "@wordpress/block-editor";
import { __ } from "@wordpress/i18n";
import { getSiteLanguages } from "../shared/languages";

// This block IS the Episode edit screen's main content — it's locked into
// place via the 'template' + template_lock: 'all' args on the episode CPT,
// registered in the separate Custom Post Types for BBS plugin (see its
// includes/episode-cpt.php; this plugin depends on that one being active —
// see this plugin's "Requires Plugins" header). Nothing insertable, nothing
// to accidentally delete. Editing fields directly here (rather than in the
// document sidebar, where this used to live) means no blank/unused content
// canvas — see src/episode/index.js's git history for the sidebar-panel
// version this replaced.
//
// save() returns null: nothing here is block content, it's all post meta
// (read/written via useEntityProp, same as the sidebar version was). The
// Episode CPT isn't publicly queryable, so this never needs a front-end
// render — no render_callback, no PHP file, unlike the CPT-backed
// custom/episode display block (src/episode-display/), which is what
// actually shows an episode's content to visitors.

// Featured Image is the one field that stays in the native sidebar (see the
// 'supports' comment in episode-cpt.php for why) — collapsed by default,
// easy to miss entirely, so this opens it automatically on mount rather
// than relying on hint text alone. Runs once; doesn't fight an editor who
// closes it afterward.
const NATIVE_PANELS_TO_AUTO_OPEN = ["featured-image"];

function EpisodeFieldsEdit() {
  const blockProps = useBlockProps({ className: "episode-fields-editor" });

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
  // post's entity record resolves in the data store (most noticeable right
  // after "Add New Episode") — default to {} so the fields below don't
  // throw and take the block down with them.
  const [meta = {}, setMeta] = useEntityProp("postType", "episode", "meta");
  const languages = getSiteLanguages();
  const videos = meta._bitesmart_episode_videos_by_lang || {};
  const keywords = meta._bitesmart_episode_keywords_by_lang || {};

  const updateMeta = (key, value) => setMeta({ ...meta, [key]: value });
  const setVideoUrl = (code, url) =>
    updateMeta("_bitesmart_episode_videos_by_lang", { ...videos, [code]: url });
  const setKeywords = (code, text) =>
    updateMeta("_bitesmart_episode_keywords_by_lang", { ...keywords, [code]: text });

  return el(
    "div",
    blockProps,

    el("h2", { className: "episode-fields-heading" }, __("Episode Details", "custom-blocks")),
    el(
      "p",
      { className: "episode-fields-hint" },
      __(
        "The episode's title goes in the “Add title” field above, and its thumbnail comes from the “Featured Image” panel in the sidebar (already opened for you). That's what lets WordPress automatically create properly-sized, optimized versions of the image. Everything else is below.",
        "custom-blocks",
      ),
    ),

    el(TextControl, {
      label: __("Episode Number", "custom-blocks"),
      value: meta._bitesmart_episode_number || "",
      onChange: (val) => updateMeta("_bitesmart_episode_number", val),
      placeholder: "e.g. 1",
    }),

    el(TextareaControl, {
      label: __("Description", "custom-blocks"),
      value: meta._bitesmart_episode_description || "",
      onChange: (val) => updateMeta("_bitesmart_episode_description", val),
      placeholder: __("e.g. Introducing a dog's stress signals.", "custom-blocks"),
      help: __("Short description shown below the title.", "custom-blocks"),
    }),

    el("h3", { className: "episode-fields-subheading" }, __("Videos", "custom-blocks")),
    // key is prefixed "video-" — this map() and the Keywords one below both
    // key by lang.code, and since both spread directly into this SAME flat
    // children array (not each wrapped in their own Fragment), an
    // unprefixed key: lang.code would collide across the two groups (found
    // as a real bug in guide-chapter-panel/index.js — tripled fields — this
    // block has the identical two-group shape, so the same fix applies
    // here even though nobody had reported it here yet).
    ...languages.map((lang) =>
      el(TextControl, {
        key: `video-${lang.code}`,
        label: `${__("Vimeo URL", "custom-blocks")} (${lang.name})`,
        value: videos[lang.code] || "",
        onChange: (val) => setVideoUrl(lang.code, val),
        placeholder: "https://vimeo.com/123456789",
      }),
    ),

    el(TextControl, {
      label: __("Downloads Page URL", "custom-blocks"),
      value: meta._bitesmart_episode_downloads_page_url || "",
      onChange: (val) => updateMeta("_bitesmart_episode_downloads_page_url", val),
      placeholder: "https://yoursite.com/downloads",
    }),

    el("hr", { style: { margin: "24px 0" } }),

    el("h3", { className: "episode-fields-subheading" }, __("Funding Credit", "custom-blocks")),

    el(TextControl, {
      label: __("Funded By", "custom-blocks"),
      value: meta._bitesmart_episode_funded_by_name || "",
      onChange: (val) => updateMeta("_bitesmart_episode_funded_by_name", val),
      help: __("Leave blank to hide the funded-by bar.", "custom-blocks"),
    }),

    el(
      MediaUploadCheck,
      null,
      el(MediaUpload, {
        onSelect: (media) =>
          updateMeta("_bitesmart_episode_funded_by_logo_id", media.id),
        allowedTypes: ["image"],
        value: meta._bitesmart_episode_funded_by_logo_id,
        render: ({ open }) =>
          el(
            Button,
            { onClick: open, variant: "secondary" },
            meta._bitesmart_episode_funded_by_logo_id
              ? __("Replace Sponsor Logo", "custom-blocks")
              : __("Choose Sponsor Logo", "custom-blocks"),
          ),
      }),
    ),

    el("hr", { style: { margin: "24px 0" } }),

    el("h3", { className: "episode-fields-subheading" }, __("Search Keywords", "custom-blocks")),
    el(
      "p",
      { className: "episode-fields-hint" },
      __(
        "Internal search-matching phrases, not shown to visitors — not automatically translated, so fill in each language directly. Helps this episode turn up in the Learning Hub Search even when a parent's wording doesn't match the description above.",
        "custom-blocks",
      ),
    ),
    ...languages.map((lang) =>
      el(TextControl, {
        key: `keyword-${lang.code}`,
        label: `${__("Keywords", "custom-blocks")} (${lang.name})`,
        value: keywords[lang.code] || "",
        onChange: (val) => setKeywords(lang.code, val),
        placeholder: __("e.g. stress signals, body language, calming signs", "custom-blocks"),
      }),
    ),
  );
}

registerBlockType("custom/episode-fields", {
  edit: EpisodeFieldsEdit,
  save: () => null,
});
