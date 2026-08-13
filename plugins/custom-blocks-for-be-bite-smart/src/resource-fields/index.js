import { registerBlockType } from "@wordpress/blocks";
import { createElement as el } from "@wordpress/element";
import { useBlockProps } from "@wordpress/block-editor";
import { useEntityProp } from "@wordpress/core-data";
import { TextControl, TextareaControl } from "@wordpress/components";
import { __ } from "@wordpress/i18n";
import { getSiteLanguages } from "../shared/languages";

// This block IS the Resource edit screen's main content — locked into
// place via the 'template' + template_lock: 'all' args on the resource CPT,
// registered in the separate Custom Post Types for BBS plugin (see its
// includes/resource-cpt.php; this plugin depends on that one being active —
// see this plugin's "Requires Plugins" header). Mirrors custom/episode-fields
// (src/episode-fields/index.js) — see that file's header comment for the
// full rationale (locked canvas over a sidebar panel, save() returns null
// since everything here is post meta via useEntityProp).

function ResourceFieldsEdit() {
  const blockProps = useBlockProps({ className: "resource-fields-editor" });

  // meta can briefly be undefined on the very first render, before the
  // post's entity record resolves in the data store — default to {} so the
  // fields below don't throw and take the block down with them.
  const [meta = {}, setMeta] = useEntityProp("postType", "resource", "meta");
  const languages = getSiteLanguages();
  const keywords = meta._bitesmart_resource_keywords_by_lang || {};

  const updateMeta = (key, value) => setMeta({ ...meta, [key]: value });
  const setKeywords = (code, text) =>
    updateMeta("_bitesmart_resource_keywords_by_lang", { ...keywords, [code]: text });

  return el(
    "div",
    blockProps,

    el("h2", { className: "resource-fields-heading" }, __("Resource Details", "custom-blocks")),
    el(
      "p",
      { className: "resource-fields-hint" },
      __(
        "The resource's title goes in the “Add title” field above. Everything else is below.",
        "custom-blocks",
      ),
    ),

    el(TextareaControl, {
      label: __("Excerpt", "custom-blocks"),
      value: meta._bitesmart_resource_excerpt || "",
      onChange: (val) => updateMeta("_bitesmart_resource_excerpt", val),
      placeholder: __("Short summary shown on the resource card.", "custom-blocks"),
    }),

    el(TextControl, {
      label: __("URL", "custom-blocks"),
      value: meta._bitesmart_resource_url || "",
      onChange: (val) => updateMeta("_bitesmart_resource_url", val),
      placeholder: "https://yoursite.com/learning/stages/preschool#growling",
      help: __("Where this resource's card links to.", "custom-blocks"),
    }),

    el("h3", { className: "resource-fields-subheading" }, __("Search Keywords", "custom-blocks")),
    el(
      "p",
      { className: "resource-fields-hint" },
      __(
        "Internal search-matching phrases, not shown to visitors — not automatically translated, so fill in each language directly.",
        "custom-blocks",
      ),
    ),
    ...languages.map((lang) =>
      el(TextControl, {
        key: lang.code,
        label: `${__("Keywords", "custom-blocks")} (${lang.name})`,
        value: keywords[lang.code] || "",
        onChange: (val) => setKeywords(lang.code, val),
        placeholder: __("e.g. growl, growling, snapped, aggressive", "custom-blocks"),
      }),
    ),
  );
}

registerBlockType("custom/resource-fields", {
  edit: ResourceFieldsEdit,
  save: () => null,
});
