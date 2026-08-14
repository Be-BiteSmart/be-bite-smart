import { registerBlockType } from "@wordpress/blocks";
import { createElement as el, useEffect } from "@wordpress/element";
import { useBlockProps } from "@wordpress/block-editor";
import { useEntityProp } from "@wordpress/core-data";
import { useSelect, useDispatch } from "@wordpress/data";
import { TextControl, TextareaControl, RadioControl, ComboboxControl, Notice } from "@wordpress/components";
import { __ } from "@wordpress/i18n";
import { getSiteLanguages } from "../shared/languages";

// Lock name for lockPostSaving()/unlockPostSaving() below — must be
// unique among any other lock some other plugin/block might register, not
// meaningful beyond that.
const STAGE_REQUIRED_LOCK = "qa-entry-requires-stage";

// This block IS the Q&A Entry edit screen's main content — locked into
// place via the 'template' + template_lock: 'all' args on the qa_entry CPT,
// registered in the separate Custom Post Types for BBS plugin (see its
// includes/qa-entry-cpt.php; this plugin depends on that one being active —
// see this plugin's "Requires Plugins" header). Mirrors custom/episode-fields
// and custom/resource-fields — see those files' header comments for the
// full rationale (locked canvas over a sidebar panel, save() returns null
// since everything here is post meta via useEntityProp).
//
// Stage and Topic tags aren't handled here — both taxonomies are attached
// via register_taxonomy_for_object_type() in qa-entry-cpt.php with default
// show_ui/show_in_rest, so Gutenberg gives them a native sidebar panel
// automatically (same as Episode's Stage panel — see episode-cpt.php, which
// has no Stage UI of its own for the same reason). Only Featured-Image-style
// collapsed-by-default panels need the auto-open treatment; taxonomy panels
// aren't collapsed by default, so no auto-open is needed here either.

function QaEntryFieldsEdit() {
  const blockProps = useBlockProps({ className: "qa-entry-fields-editor" });

  // meta can briefly be undefined on the very first render, before the
  // post's entity record resolves in the data store — default to {} so the
  // fields below don't throw and take the block down with them.
  const [meta = {}, setMeta] = useEntityProp("postType", "qa_entry", "meta");
  const languages = getSiteLanguages();
  const synonyms = meta._bitesmart_qa_synonyms_by_lang || {};
  const answerType = meta._bitesmart_qa_answer_type || "short";
  const linkType = meta._bitesmart_qa_link_type || "url";

  const updateMeta = (key, value) => setMeta({ ...meta, [key]: value });
  const setSynonyms = (code, text) =>
    updateMeta("_bitesmart_qa_synonyms_by_lang", { ...synonyms, [code]: text });

  // Stage is how a Q&A Entry gets found at all (see
  // bitesmart_build_stage_card_list() in learning-search.php) — but unlike
  // Episode/Coloring Book, there's no single sensible Stage to default a
  // Q&A Entry to (see bitesmart_default_episode_stage_term() in
  // episode-cpt.php for that pattern), so rather than silently letting one
  // save with no Stage and quietly never show up anywhere, saving itself
  // is blocked until at least one is picked in the sidebar panel — same
  // lockPostSaving()/unlockPostSaving() mechanism WordPress itself uses
  // for "can't publish yet" states, not a dismissible-and-forgettable
  // alert. Blocks Save Draft too, not just Publish/Update — deliberately
  // strict, per Janet's "when trying to save" (not "when trying to
  // publish").
  const stageTermIds = useSelect(
    (select) => select("core/editor").getEditedPostAttribute("stage") || [],
    [],
  );
  const hasStage = stageTermIds.length > 0;

  const { lockPostSaving, unlockPostSaving } = useDispatch("core/editor");
  useEffect(() => {
    if (hasStage) {
      unlockPostSaving(STAGE_REQUIRED_LOCK);
    } else {
      lockPostSaving(STAGE_REQUIRED_LOCK);
    }
  }, [hasStage, lockPostSaving, unlockPostSaving]);

  const resources = useSelect(
    (select) =>
      linkType === "resource"
        ? select("core").getEntityRecords("postType", "resource", {
            per_page: -1,
            status: "any",
            orderby: "title",
            order: "asc",
          })
        : null,
    [linkType],
  );

  const resourceOptions = (resources || []).map((resource) => ({
    value: resource.id,
    label:
      (resource.title?.rendered || __("(untitled)", "custom-blocks")) +
      (resource.status !== "publish" ? ` (${resource.status})` : ""),
  }));

  return el(
    "div",
    blockProps,

    !hasStage &&
      el(
        Notice,
        { status: "warning", isDismissible: false },
        __(
          "A Stage must be selected before this Q&A Entry can be saved — choose one in the Stage panel in the sidebar.",
          "custom-blocks",
        ),
      ),

    el("h2", { className: "qa-entry-fields-heading" }, __("Q&A Entry Details", "custom-blocks")),
    el(
      "p",
      { className: "qa-entry-fields-hint" },
      __(
        "The question goes in the “Add title” field above. Stage and Topic tags are in the sidebar panels. Everything else is below.",
        "custom-blocks",
      ),
    ),

    el(RadioControl, {
      label: __("Answer Type", "custom-blocks"),
      selected: answerType,
      options: [
        { label: __("Short Answer", "custom-blocks"), value: "short" },
        { label: __("Long Answer", "custom-blocks"), value: "long" },
      ],
      onChange: (val) => updateMeta("_bitesmart_qa_answer_type", val),
    }),

    el(TextareaControl, {
      label: answerType === "long" ? __("Teaser", "custom-blocks") : __("Answer", "custom-blocks"),
      value: meta._bitesmart_qa_answer_text || "",
      onChange: (val) => updateMeta("_bitesmart_qa_answer_text", val),
      placeholder:
        answerType === "long"
          ? __("A short teaser shown before the “Read the full guide” link.", "custom-blocks")
          : __("The complete answer, shown inline.", "custom-blocks"),
      help:
        answerType === "long"
          ? __("Long Answer: this is a teaser, not the full answer — the full content lives at the Link Destination below.", "custom-blocks")
          : __("Short Answer: this is the complete answer.", "custom-blocks"),
    }),

    el("hr", { style: { margin: "24px 0" } }),

    el("h3", { className: "qa-entry-fields-subheading" }, __("Link Destination", "custom-blocks")),
    el(
      "p",
      { className: "qa-entry-fields-hint" },
      __(
        "Shown as a “Read the full guide” link when Answer Type is Long Answer. If it points to a Resource post, that Resource's Keywords also get merged into this entry's search matching.",
        "custom-blocks",
      ),
    ),

    el(RadioControl, {
      label: __("Link Type", "custom-blocks"),
      selected: linkType,
      options: [
        { label: __("Resource post", "custom-blocks"), value: "resource" },
        { label: __("Custom URL", "custom-blocks"), value: "url" },
      ],
      onChange: (val) => updateMeta("_bitesmart_qa_link_type", val),
    }),

    linkType === "resource"
      ? el(ComboboxControl, {
          label: __("Choose a Resource", "custom-blocks"),
          value: meta._bitesmart_qa_link_resource_id || undefined,
          options: resourceOptions,
          onChange: (value) =>
            updateMeta("_bitesmart_qa_link_resource_id", value ? Number(value) : 0),
        })
      : el(TextControl, {
          label: __("URL", "custom-blocks"),
          value: meta._bitesmart_qa_link_url || "",
          onChange: (val) => updateMeta("_bitesmart_qa_link_url", val),
          placeholder: "https://yoursite.com/learning/stages/preschool#growling",
        }),

    el("hr", { style: { margin: "24px 0" } }),

    el("h3", { className: "qa-entry-fields-subheading" }, __("Search Synonyms", "custom-blocks")),
    el(
      "p",
      { className: "qa-entry-fields-hint" },
      __(
        "Internal search-matching phrases, not shown to visitors — not automatically translated, so fill in each language directly.",
        "custom-blocks",
      ),
    ),
    ...languages.map((lang) =>
      el(TextControl, {
        key: lang.code,
        label: `${__("Synonyms", "custom-blocks")} (${lang.name})`,
        value: synonyms[lang.code] || "",
        onChange: (val) => setSynonyms(lang.code, val),
        placeholder: __("e.g. growl, growling, snapped, aggressive", "custom-blocks"),
      }),
    ),
  );
}

registerBlockType("custom/qa-entry-fields", {
  edit: QaEntryFieldsEdit,
  save: () => null,
});
