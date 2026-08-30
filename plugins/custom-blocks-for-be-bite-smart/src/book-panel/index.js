import { registerPlugin } from "@wordpress/plugins";
import { PluginDocumentSettingPanel } from "@wordpress/editor";
import { createElement as el, useEffect, useRef } from "@wordpress/element";
import { useEntityProp } from "@wordpress/core-data";
import { useDispatch, useSelect, select as dataSelect } from "@wordpress/data";
import {
  TextControl,
  RadioControl,
  Button,
  Notice,
} from "@wordpress/components";
import { MediaUpload, MediaUploadCheck } from "@wordpress/block-editor";
import { __ } from "@wordpress/i18n";

// UNLIKE every *-fields block in this plugin (episode-fields,
// resource-fields, qa-entry-fields, coloring-book-fields, guide-fields),
// this is NOT a locked-canvas block — it's a PluginDocumentSettingPanel, a
// sidebar panel. book's editor canvas is deliberately left UNLOCKED (see
// book-cpt.php): post_content IS the book's "why we recommend it" body,
// authored with the normal block editor (restricted to Paragraph/List — see
// bitesmart_restrict_book_allowed_blocks() there), so there's no room for a
// canvas-filling fields block here — everything that ISN'T that body lives
// in this sidebar panel instead. Its script is enqueued only on the book
// edit screen (see bitesmart_enqueue_book_panel() in this plugin's
// book-panel.php), not registered as a block at all — no block.json next to
// this file, same as guide-chapter-panel.

// Featured Image is the one native field that stays in the sidebar —
// collapsed by default, easy to miss, so this opens it automatically on
// mount rather than relying on hint text alone. Same pattern as
// episode-fields/index.js and guide-fields/index.js. Runs once; doesn't
// fight an editor who closes it afterward.
const NATIVE_PANELS_TO_AUTO_OPEN = ["featured-image"];

function BookPanel() {
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
  // fields below don't throw and take the panel down with them.
  const [meta = {}, setMeta] = useEntityProp("postType", "book", "meta");
  const previewImageIds = meta._bitesmart_book_preview_images || [];
  const buyLinks = meta._bitesmart_book_buy_links || [];

  const updateMeta = (key, value) => setMeta({ ...meta, [key]: value });

  // One-time migration nudge, per Janet: a book saved before Buy Links
  // existed only has the old single _bitesmart_book_url field. The first
  // time this panel sees such a book with an empty buy-links list, seed the
  // list with that URL as one (unlabeled) row so it's visible in the new UI
  // instead of silently vanishing. Guarded by a ref, not just "list is
  // empty", so deliberately clearing every row later in the same session
  // doesn't get re-filled — it only ever fires once, and only once the real
  // meta object has resolved (meta starts as the {} placeholder above).
  const didPrefillLegacyUrl = useRef(false);
  useEffect(() => {
    if (didPrefillLegacyUrl.current) {
      return;
    }
    const metaResolved =
      typeof meta._bitesmart_book_url !== "undefined" ||
      typeof meta._bitesmart_book_buy_links !== "undefined";
    if (!metaResolved) {
      return; // still waiting on the entity record to resolve.
    }
    didPrefillLegacyUrl.current = true;

    const legacyUrl = meta._bitesmart_book_url;
    const hasBuyLinks =
      Array.isArray(meta._bitesmart_book_buy_links) &&
      meta._bitesmart_book_buy_links.length > 0;
    if (!hasBuyLinks && legacyUrl) {
      updateMeta("_bitesmart_book_buy_links", [{ label: "", url: legacyUrl }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta._bitesmart_book_url, meta._bitesmart_book_buy_links]);

  // Resolves each selected attachment ID to its media object (for the
  // thumbnail strip below) — @wordpress/core-data auto-fetches and caches
  // these, same as any other "core" entity read; a not-yet-resolved id
  // just renders no thumbnail image for a moment, not an error.
  const previewMedia = useSelect(
    (select) => previewImageIds.map((id) => select("core").getMedia(id)),
    [previewImageIds],
  );

  return el(
    PluginDocumentSettingPanel,
    {
      name: "book-details",
      title: __("Book Details", "custom-blocks"),
      initialOpen: true,
    },

    el(
      "p",
      { className: "components-base-control__help", style: { marginTop: 0 } },
      __(
        "The cover image goes in Featured Image below. The “why we recommend it” text goes in the main canvas — add a Quote block afterward for the book’s own description or a review quote.",
        "custom-blocks",
      ),
    ),

    // Added 2026-08-16, per Janet: some book recommendations are kid-facing,
    // some are written for an adult reader — Stage alone doesn't capture
    // that (a book can suit every Stage the way general dog-body-language
    // knowledge is useful at any age). Same RadioControl toggle pattern as
    // Q&A Entry's own Answer Type field (see qa-entry-fields/index.js) —
    // visual badge only on the front end (see book-display.php), not wired
    // into any search/browse filter. Expanded 2026-08-29, per Janet, from
    // two options to four — her Books page groups recommendations more
    // finely than "any age vs. adult" could express. Fixed order is hers:
    // Younger Children, Older Children, Adults, All Ages (With Guidance) —
    // the last one covers her original "works for both" case (a kid-friendly
    // book a parent can read too), just relabeled for clarity now that it
    // sits alongside two age-specific options.
    el(RadioControl, {
      label: __("Audience", "custom-blocks"),
      selected: meta._bitesmart_book_audience || "all_ages",
      options: [
        {
          label: __("Younger Children", "custom-blocks"),
          value: "younger_children",
        },
        {
          label: __("Older Children", "custom-blocks"),
          value: "older_children",
        },
        { label: __("Adults", "custom-blocks"), value: "adult" },
        {
          label: __("All Ages (With Guidance)", "custom-blocks"),
          value: "all_ages",
        },
      ],
      onChange: (val) => updateMeta("_bitesmart_book_audience", val),
    }),

    el(TextControl, {
      label: __("Price / Availability", "custom-blocks"),
      value: meta._bitesmart_book_price_availability || "",
      onChange: (val) => updateMeta("_bitesmart_book_price_availability", val),
      placeholder: __("e.g. $8.99 and widely available", "custom-blocks"),
    }),

    // Added 2026-08-30, per Janet: a book can be available from more than
    // one retailer (e.g. Amazon, Target), each wanting its own button label —
    // see bitesmart_sanitize_book_buy_links() in book-cpt.php and
    // render_book_block() in book-display.php for how each {label, url} row
    // becomes a button. Same hand-rolled add/remove-row idiom as the preview
    // images picker below, since this codebase has no repeater field type to
    // reach for (no ACF/Meta Box here — see book-cpt.php's file header).
    el(
      "p",
      { style: { fontWeight: 600, marginBottom: 4 } },
      __("Buy Links", "custom-blocks"),
    ),
    el(
      "p",
      { className: "components-base-control__help", style: { marginTop: 0 } },
      __(
        "One button per place this book can be bought (e.g. Amazon, Target). Leave the list empty if there's nowhere to send parents yet.",
        "custom-blocks",
      ),
    ),
    ...buyLinks.map((link, index) =>
      el(
        "div",
        { key: index, style: { marginBottom: "8px" } },
        el(
          "div",
          { style: { display: "flex", gap: "6px", alignItems: "flex-start" } },
          el(TextControl, {
            label: __("Label", "custom-blocks"),
            value: link.label || "",
            onChange: (val) => {
              const next = [...buyLinks];
              next[index] = { ...next[index], label: val };
              updateMeta("_bitesmart_book_buy_links", next);
            },
            placeholder: __("e.g. Amazon", "custom-blocks"),
            style: { flex: "1 1 40%" },
          }),
          el(TextControl, {
            label: __("URL", "custom-blocks"),
            value: link.url || "",
            onChange: (val) => {
              const next = [...buyLinks];
              next[index] = { ...next[index], url: val };
              updateMeta("_bitesmart_book_buy_links", next);
            },
            placeholder: "https://...",
            style: { flex: "1 1 60%" },
          }),
          el(Button, {
            icon: "no-alt",
            label: __("Remove", "custom-blocks"),
            onClick: () =>
              updateMeta(
                "_bitesmart_book_buy_links",
                buyLinks.filter(
                  (_link, existingIndex) => existingIndex !== index,
                ),
              ),
            style: { marginTop: "22px" },
          }),
        ),
        // Informational only, per Janet — a blank label still saves and
        // still renders (render_book_block() falls back to "Buy / More
        // Info"), this just nudges toward filling it in.
        link.url &&
          !(link.label || "").trim() &&
          el(
            Notice,
            {
              status: "warning",
              isDismissible: false,
              className: "book-buy-link-warning",
            },
            __(
              "Add a label so visitors know what this button says.",
              "custom-blocks",
            ),
          ),
      ),
    ),
    el(
      Button,
      {
        variant: "secondary",
        onClick: () =>
          updateMeta("_bitesmart_book_buy_links", [
            ...buyLinks,
            { label: "", url: "" },
          ]),
        style: { marginBottom: 16 },
      },
      __("Add Buy Link", "custom-blocks"),
    ),

    // Added 2026-08-29, per Janet: optional photos of a few pages inside the
    // book, so a visitor gets a "sneak peek" beyond just the cover. Shown as
    // a small carousel after the cover on the front end (see
    // bitesmart_book_cover_gallery() in book-display.php) — leave this empty
    // and the card looks exactly as it does today, just the cover.
    el(
      "p",
      { style: { fontWeight: 600, marginBottom: 4 } },
      __("Inside the Book (Optional)", "custom-blocks"),
    ),
    el(
      "p",
      { className: "components-base-control__help", style: { marginTop: 0 } },
      __(
        "A few photos of the book's interior pages, shown as a small carousel after the cover. Leave empty to show just the cover.",
        "custom-blocks",
      ),
    ),
    el(
      MediaUploadCheck,
      null,
      el(MediaUpload, {
        onSelect: (mediaItems) =>
          updateMeta(
            "_bitesmart_book_preview_images",
            mediaItems.map((item) => item.id),
          ),
        allowedTypes: ["image"],
        multiple: true,
        gallery: true,
        value: previewImageIds,
        render: ({ open }) =>
          el(
            Button,
            { onClick: open, variant: "secondary" },
            previewImageIds.length
              ? __("Edit Preview Images", "custom-blocks")
              : __("Add Preview Images", "custom-blocks"),
          ),
      }),
    ),
    previewImageIds.length > 0 &&
      el(
        "div",
        {
          style: {
            display: "flex",
            flexWrap: "wrap",
            gap: "6px",
            marginTop: "8px",
          },
        },
        ...previewImageIds.map((id, index) => {
          const media = previewMedia[index];
          const thumbUrl =
            media?.media_details?.sizes?.thumbnail?.source_url ||
            media?.source_url;
          return el(
            "div",
            {
              key: id,
              style: { position: "relative", width: "48px", height: "48px" },
            },
            thumbUrl &&
              el("img", {
                src: thumbUrl,
                alt: "",
                style: {
                  width: "48px",
                  height: "48px",
                  objectFit: "cover",
                  borderRadius: "2px",
                  border: "1px solid #ddd",
                },
              }),
            el(Button, {
              icon: "no-alt",
              label: __("Remove", "custom-blocks"),
              onClick: () =>
                updateMeta(
                  "_bitesmart_book_preview_images",
                  previewImageIds.filter((existingId) => existingId !== id),
                ),
              style: {
                position: "absolute",
                top: "-6px",
                right: "-6px",
                minWidth: "20px",
                height: "20px",
                padding: 0,
                background: "#fff",
                borderRadius: "50%",
                border: "1px solid #ccc",
              },
            }),
          );
        }),
      ),
  );
}

registerPlugin("book-panel", { render: BookPanel });
