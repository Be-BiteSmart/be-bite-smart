import { registerBlockType } from "@wordpress/blocks";
import { createElement as el, useEffect, useState } from "@wordpress/element";
import { useBlockProps } from "@wordpress/block-editor";
import { useEntityProp } from "@wordpress/core-data";
import { useSelect, useDispatch } from "@wordpress/data";
import {
  TextControl,
  TextareaControl,
  RadioControl,
  ComboboxControl,
  CheckboxControl,
  Notice,
  Modal,
  Button,
} from "@wordpress/components";
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
//
// Chapter Link + the conditional Search Synonyms section below were added
// 2026-09-04 per [[be-bitesmart-qa-chapter-link-plan]] in memory: linking
// this entry to a Guide Chapter (guide-chapter-cpt.php) makes it inherit
// that chapter's Synonyms (default-on, opt-out per token) instead of
// keeping its own — the chapter is a synonym SUPERSET of any one Q&A aspect
// of it, so duplicating text between the two would just be copy-paste. See
// bitesmart_qa_entry_chapter_keywords() in learning-search.php for the
// read-side of this.

/** Shared confirm/consequence dialog for both chapter-link edge cases below — same shape (message + actions), just different copy/actions each time. */
function ChapterLinkConfirmModal({ title, onRequestClose, children, actions }) {
  return el(
    Modal,
    { title, onRequestClose, className: "qa-entry-chapter-link-confirm-modal" },
    el("div", { className: "qa-entry-chapter-link-confirm-modal-body" }, children),
    el(
      "div",
      {
        className: "qa-entry-chapter-link-confirm-modal-actions",
        style: { display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 },
      },
      actions.map((action, index) =>
        el(
          Button,
          {
            key: index,
            variant: action.variant || "tertiary",
            isBusy: action.isBusy,
            disabled: action.disabled,
            onClick: action.onClick,
          },
          action.label,
        ),
      ),
    ),
  );
}

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
  const linkedChapterId = meta._bitesmart_qa_link_chapter_id || 0;
  const chapterExcludes = meta._bitesmart_qa_chapter_synonym_excludes_by_lang || {};

  const updateMeta = (key, value) => setMeta({ ...meta, [key]: value });
  const setSynonyms = (code, text) =>
    updateMeta("_bitesmart_qa_synonyms_by_lang", { ...synonyms, [code]: text });
  const setChapterExcludes = (code, tokens) =>
    updateMeta("_bitesmart_qa_chapter_synonym_excludes_by_lang", { ...chapterExcludes, [code]: tokens });

  // The one place _bitesmart_qa_link_chapter_id and
  // _bitesmart_qa_chapter_synonym_excludes_by_lang actually change together —
  // a fresh link (or no link) always starts with a clean excludes list, since
  // an exclude only makes sense relative to the specific chapter it was
  // recorded against (see Edge case 2 in the design doc).
  const applyChapterLink = (newChapterId) => {
    setMeta({
      ...meta,
      _bitesmart_qa_link_chapter_id: newChapterId,
      _bitesmart_qa_chapter_synonym_excludes_by_lang: {},
    });
    setPendingChapterChange(null);
  };

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

  // Chapter Link picker options — every chapter, same "(status)" suffix
  // convention as the Resource picker above.
  const chapters = useSelect(
    (select) =>
      select("core").getEntityRecords("postType", "guide_chapter", {
        per_page: -1,
        status: "any",
        orderby: "title",
        order: "asc",
      }),
    [],
  );

  const chapterOptions = (chapters || []).map((chapter) => ({
    value: chapter.id,
    label:
      (chapter.title?.rendered || __("(untitled)", "custom-blocks")) +
      (chapter.status !== "publish" ? ` (${chapter.status})` : ""),
  }));

  // The currently-LINKED chapter's own record — needed to render its
  // Synonyms as the checkbox list below. Kept separate from the picker's
  // options list above since that list may load without `meta` depending on
  // the collection endpoint's response context; fetching this one record
  // directly guarantees `meta` is present (subject to the same
  // edit_post-on-that-chapter permission as any other registered meta read).
  const linkedChapter = useSelect(
    (select) =>
      linkedChapterId ? select("core").getEntityRecord("postType", "guide_chapter", linkedChapterId) : null,
    [linkedChapterId],
  );
  // undefined = still resolving; null, or a non-'publish' status once
  // resolved, = dangling link (chapter trashed/deleted/unpublished) — Edge
  // case 3. Never true while still loading, so this notice doesn't flash on
  // every normal load of an entry that's linked to a perfectly live chapter.
  const chapterLinkDangling =
    linkedChapterId > 0 && linkedChapter !== undefined && (!linkedChapter || linkedChapter.status !== "publish");

  const chapterTokensForLang = (code) =>
    ((linkedChapter?.meta?._bitesmart_chapter_keywords_by_lang || {})[code] || "")
      .split(",")
      .map((token) => token.trim())
      .filter(Boolean);

  const isTokenExcluded = (code, token) =>
    (chapterExcludes[code] || []).some((excluded) => excluded.toLowerCase() === token.toLowerCase());

  const toggleTokenExcluded = (code, token, excluded) => {
    const current = chapterExcludes[code] || [];
    const next = excluded
      ? [...current, token]
      : current.filter((existing) => existing.toLowerCase() !== token.toLowerCase());
    setChapterExcludes(code, next);
  };

  // pendingChapterChange !== null while one of the two confirm modals below
  // is open, holding the chapter id the picker was just changed TO (0 for
  // "cleared"). Nothing in meta changes until the editor confirms —
  // cancelling just closes the modal, and the picker's own `value` (still
  // bound to linkedChapterId) reverts on its own since nothing was applied.
  const [pendingChapterChange, setPendingChapterChange] = useState(null);

  const ownSynonymsNonEmpty = languages.some((lang) => (synonyms[lang.code] || "").trim() !== "");
  const hasAnyExcludes = Object.values(chapterExcludes).some((tokens) => (tokens || []).length > 0);

  const onChapterPickerChange = (value) => {
    const newChapterId = value ? Number(value) : 0;
    if (newChapterId === linkedChapterId) {
      return;
    }

    if (!linkedChapterId && newChapterId && ownSynonymsNonEmpty) {
      // Edge case 1: turning a link ON for the first time, over existing
      // typed-in synonyms that are about to go dormant.
      setPendingChapterChange({ type: "link-over-own-synonyms", newChapterId });
      return;
    }

    if (linkedChapterId && hasAnyExcludes) {
      // Edge case 2: switching to a different chapter, or clearing the
      // link entirely, while this entry has excluded tokens recorded
      // against the CURRENT chapter — those would become meaningless.
      setPendingChapterChange({ type: "change-link", newChapterId });
      return;
    }

    applyChapterLink(newChapterId);
  };

  // Only fetched while Edge case 1's modal is open, to preview + merge into
  // — a separate record from linkedChapter above (that one always tracks
  // the chapter actually saved in meta, not whatever the picker was just
  // moved to).
  const pendingTargetChapterId =
    pendingChapterChange?.type === "link-over-own-synonyms" ? pendingChapterChange.newChapterId : 0;
  const pendingTargetChapter = useSelect(
    (select) =>
      pendingTargetChapterId
        ? select("core").getEntityRecord("postType", "guide_chapter", pendingTargetChapterId)
        : null,
    [pendingTargetChapterId],
  );

  const { saveEntityRecord } = useDispatch("core");

  const addOwnSynonymsToChapterThenLink = async () => {
    const chapterId = pendingChapterChange.newChapterId;
    const currentChapterKeywords = pendingTargetChapter?.meta?._bitesmart_chapter_keywords_by_lang || {};
    const mergedKeywords = { ...currentChapterKeywords };

    languages.forEach((lang) => {
      const ownTokens = (synonyms[lang.code] || "")
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean);
      if (!ownTokens.length) {
        return;
      }

      const existingTokens = (mergedKeywords[lang.code] || "")
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean);
      const existingLower = existingTokens.map((token) => token.toLowerCase());
      const newTokens = ownTokens.filter((token) => !existingLower.includes(token.toLowerCase()));

      mergedKeywords[lang.code] = [...existingTokens, ...newTokens].join(", ");
    });

    await saveEntityRecord("postType", "guide_chapter", {
      id: chapterId,
      meta: { _bitesmart_chapter_keywords_by_lang: mergedKeywords },
    });

    applyChapterLink(chapterId);
  };

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

    el("h3", { className: "qa-entry-fields-subheading" }, __("Chapter Link", "custom-blocks")),
    el(
      "p",
      { className: "qa-entry-fields-hint" },
      __(
        "Optional — link this entry to the Guide Chapter it's an aspect of. When linked, this entry's search matching inherits that chapter's Synonyms automatically (see below) instead of keeping its own.",
        "custom-blocks",
      ),
    ),
    el(ComboboxControl, {
      label: __("Guide Chapter", "custom-blocks"),
      value: linkedChapterId || undefined,
      options: chapterOptions,
      onChange: onChapterPickerChange,
    }),

    el("hr", { style: { margin: "24px 0" } }),

    el("h3", { className: "qa-entry-fields-subheading" }, __("Search Synonyms", "custom-blocks")),

    linkedChapterId
      ? el(
          "div",
          { className: "qa-entry-chapter-synonyms" },
          chapterLinkDangling &&
            el(
              Notice,
              { status: "warning", isDismissible: false },
              __(
                "The linked chapter is missing or no longer published, so its Synonyms aren't currently applied to this entry's search matching. Pick a different chapter above, or clear the Chapter Link field to use this entry's own synonyms below instead.",
                "custom-blocks",
              ),
            ),
          !chapterLinkDangling &&
            el(
              "p",
              { className: "qa-entry-fields-hint" },
              __(
                "Inherited from the linked chapter's own Synonyms — every term applies by default; uncheck any that don't fit this specific question. To add a new term, add it on the chapter itself (Chapter Details panel), not here.",
                "custom-blocks",
              ),
            ),
          !chapterLinkDangling &&
            linkedChapter === undefined &&
            el("p", { className: "qa-entry-fields-hint" }, __("Loading chapter synonyms…", "custom-blocks")),
          !chapterLinkDangling &&
            linkedChapter !== undefined &&
            languages.map((lang) => {
              const tokens = chapterTokensForLang(lang.code);
              return el(
                "div",
                { key: lang.code, className: "qa-entry-chapter-synonyms-lang" },
                el(
                  "p",
                  { style: { fontWeight: 600, marginBottom: 4 } },
                  `${__("Synonyms", "custom-blocks")} (${lang.name})`,
                ),
                tokens.length === 0
                  ? el(
                      "p",
                      { className: "components-base-control__help" },
                      __("This chapter has no Synonyms yet for this language.", "custom-blocks"),
                    )
                  : tokens.map((token) =>
                      el(CheckboxControl, {
                        key: token,
                        label: token,
                        checked: !isTokenExcluded(lang.code, token),
                        onChange: (checked) => toggleTokenExcluded(lang.code, token, !checked),
                      }),
                    ),
              );
            }),
        )
      : el(
          "div",
          {},
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
        ),

    // Edge case 1: linking over existing typed-in synonyms.
    pendingChapterChange?.type === "link-over-own-synonyms" &&
      el(
        ChapterLinkConfirmModal,
        {
          title: __("This entry already has its own synonyms", "custom-blocks"),
          onRequestClose: () => setPendingChapterChange(null),
          actions: [
            {
              label: __("Cancel", "custom-blocks"),
              onClick: () => setPendingChapterChange(null),
            },
            {
              label: __("Link without them", "custom-blocks"),
              onClick: () => applyChapterLink(pendingChapterChange.newChapterId),
            },
            {
              label: __("Add these terms to the chapter, then link", "custom-blocks"),
              variant: "primary",
              isBusy: pendingTargetChapter === undefined,
              disabled: pendingTargetChapter === undefined,
              onClick: addOwnSynonymsToChapterThenLink,
            },
          ],
        },
        el(
          "p",
          {},
          __(
            "Linking switches this entry to the chapter's Synonyms list — the synonyms already typed in below won't be used for matching unless they're also on the chapter. You can add them to the chapter now (recommended, so nothing is lost), or link without them.",
            "custom-blocks",
          ),
        ),
      ),

    // Edge case 2: switching or clearing a link that has excludes recorded
    // against the chapter currently linked.
    pendingChapterChange?.type === "change-link" &&
      el(
        ChapterLinkConfirmModal,
        {
          title: pendingChapterChange.newChapterId
            ? __("Switch this entry's linked chapter?", "custom-blocks")
            : __("Remove this entry's chapter link?", "custom-blocks"),
          onRequestClose: () => setPendingChapterChange(null),
          actions: [
            {
              label: __("Cancel", "custom-blocks"),
              onClick: () => setPendingChapterChange(null),
            },
            {
              label: __("Continue", "custom-blocks"),
              variant: "primary",
              onClick: () => applyChapterLink(pendingChapterChange.newChapterId),
            },
          ],
        },
        el(
          "p",
          {},
          __(
            "This resets which of the current chapter's synonyms this entry has toggled off — the chapter's own Synonyms list is unaffected.",
            "custom-blocks",
          ),
        ),
      ),
  );
}

registerBlockType("custom/qa-entry-fields", {
  edit: QaEntryFieldsEdit,
  save: () => null,
});
