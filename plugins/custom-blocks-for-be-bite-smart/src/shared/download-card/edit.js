import {
  useBlockProps,
  InspectorControls,
  MediaUpload,
  RichText,
} from "@wordpress/block-editor";
import { PanelBody, ClipboardButton } from "@wordpress/components";
import { previewStyles } from "./preview-styles";
import { computeSeriesAnchorId } from "./anchor-id";

export function DownloadCardEdit({ attributes, setAttributes, clientId, config }) {
  const blockProps = useBlockProps();
  const { blockIdPrefix, features, editorHelp, anchorPrefix } = config;
  const wp = window.wp;
  const [hasCopiedAnchor, setHasCopiedAnchor] = wp.element.useState(false);

  // Anchor id ("blockId") — the wrapper's id in save.js, so a Resource
  // entry's URL can link straight to this instance. Two modes:
  //  - anchorPrefix set (e.g. "coloring-books"): auto-derive it from the
  //    Series + Episode # (computeSeriesAnchorId), same
  //    "give the real embed a stable anchor id, link to it" pattern as
  //    bitesmart_episode_anchor_id() — no manual copying needed. Recomputed
  //    whenever Episode # changes, so it's always in sync with what's
  //    visible in the sidebar below.
  //  - otherwise (or before an Episode # is filled in): a random id, set
  //    once and left alone, same as before this existed.
  wp.element.useEffect(() => {
    const deterministicId = computeSeriesAnchorId(
      anchorPrefix,
      attributes.episodeNumber,
    );
    if (deterministicId) {
      if (deterministicId !== attributes.blockId) {
        setAttributes({ blockId: deterministicId });
      }
      return;
    }
    if (!attributes.blockId) {
      setAttributes({ blockId: blockIdPrefix + "-" + clientId.slice(0, 8) });
    }
  }, [anchorPrefix, attributes.episodeNumber]);

  const showPdfAndLinks = features.pdf && features.downloadLinks;

  return wp.element.createElement(
    "div",
    blockProps,

    (features.pdf && features.trackingSlug) &&
      wp.element.createElement(
        InspectorControls,
        null,
        wp.element.createElement(
          PanelBody,
          { title: "About this block", initialOpen: true },
          wp.element.createElement(
            "label",
            {
              style: {
                fontSize: "13px",
                fontWeight: "600",
                display: "block",
                marginBottom: "4px",
              },
            },
            "PDF tracking slug (optional)",
          ),
          wp.element.createElement("input", {
            type: "text",
            value: attributes.trackingId,
            onChange: (e) => setAttributes({ trackingId: e.target.value }),
            placeholder: "e.g. partnership-pdf — overrides pdf-viewed",
            style: { width: "100%", marginBottom: "12px" },
          }),
          wp.element.createElement(
            "p",
            {
              style: {
                fontSize: "12px",
                color: "#50575e",
                marginTop: "0",
                marginBottom: "12px",
              },
            },
            "Leave blank for default pdf-viewed events. Set only when this block's PDF needs its own Plausible goal.",
          ),
        ),
      ),

    editorHelp &&
      wp.element.createElement(
        InspectorControls,
        null,
        wp.element.createElement(
          PanelBody,
          { title: "About this block", initialOpen: true },
          wp.element.createElement(
            "p",
            { style: { fontSize: "13px", color: "#50575e", margin: 0 } },
            editorHelp,
          ),
        ),
      ),

    attributes.blockId &&
      wp.element.createElement(
        InspectorControls,
        null,
        wp.element.createElement(
          PanelBody,
          { title: "Anchor ID (for Resource links)", initialOpen: false },
          wp.element.createElement(
            "p",
            { style: { fontSize: "12px", color: "#50575e", marginTop: 0 } },
            anchorPrefix
              ? "Auto-generated from the Episode # above, so it's stable once that's filled in — no need to copy it anywhere. To make this download findable in /learning/ search, create a Resource entry (Stage/Topic taxonomy) whose URL is this page's URL plus this fragment."
              : "To make this download findable in /learning/ search, create a Resource entry (Stage/Topic taxonomy) whose URL is this page's URL plus the fragment below.",
          ),
          anchorPrefix &&
            !attributes.episodeNumber &&
            wp.element.createElement(
              "p",
              {
                style: {
                  fontSize: "12px",
                  color: "#b32d2e",
                  marginTop: 0,
                  marginBottom: "8px",
                },
              },
              "No Episode # yet — this id is temporary and will change once one is filled in.",
            ),
          wp.element.createElement("input", {
            type: "text",
            readOnly: true,
            value: "#" + attributes.blockId,
            style: {
              width: "100%",
              marginBottom: "8px",
              fontFamily: "monospace",
              fontSize: "12px",
            },
            onFocus: (e) => e.target.select(),
          }),
          wp.element.createElement(
            ClipboardButton,
            {
              variant: "secondary",
              text: "#" + attributes.blockId,
              onCopy: () => setHasCopiedAnchor(true),
              onFinishCopy: () => setHasCopiedAnchor(false),
            },
            hasCopiedAnchor ? "Copied!" : "Copy anchor fragment",
          ),
        ),
      ),

    showPdfAndLinks &&
      wp.element.createElement(
        InspectorControls,
        null,
        wp.element.createElement(
          PanelBody,
          { title: "PDF or download links", initialOpen: true },
          wp.element.createElement(
            "p",
            { style: { fontSize: "13px", color: "#50575e", margin: 0 } },
            "Per language: upload a PDF for View PDF + Download in one row, or paste a download link for a single Download button. Spanish rows appear only when Spanish files or links are added.",
          ),
        ),
      ),

    wp.element.createElement(
      "div",
      { style: previewStyles.wrapper },

      wp.element.createElement(
        "div",
        { style: previewStyles.header },

        wp.element.createElement(RichText, {
          tagName: "div",
          value: attributes.episodeNumber,
          onChange: (val) => setAttributes({ episodeNumber: val }),
          placeholder: "#",
          className: "bright-chip",
          style: { padding: "0 16px" },
          onSplit: () => {},
          disableLineBreaks: true,
        }),

        wp.element.createElement(
          "div",
          { style: previewStyles.meta },
          wp.element.createElement(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "4px" } },
            wp.element.createElement(
              "span",
              { className: "capitalized-and-colored" },
              attributes.episodeNumber
                ? "EPISODE " + attributes.episodeNumber + " · "
                : "EPISODE # · ",
            ),
            wp.element.createElement(RichText, {
              tagName: "span",
              value: attributes.contentType,
              onChange: (val) => setAttributes({ contentType: val }),
              placeholder: "Content type",
              className: "capitalized-and-colored",
              onSplit: () => {},
              disableLineBreaks: true,
            }),
          ),
          wp.element.createElement(RichText, {
            tagName: "div",
            value: attributes.episodeTitle,
            onChange: (val) => setAttributes({ episodeTitle: val }),
            placeholder: "Episode title",
            style: previewStyles.title,
            onSplit: () => {},
            disableLineBreaks: true,
          }),
        ),
      ),

      features.pdf &&
        wp.element.createElement(
          "div",
          { style: previewStyles.uploadArea },
          ["English PDF", "Spanish PDF"].map((label, i) => {
            const attr = i === 0 ? "pdfUrl" : "pdfUrlEs";
            return wp.element.createElement(
              "div",
              { key: attr, style: previewStyles.uploadGroup },
              wp.element.createElement(
                "span",
                { style: previewStyles.uploadLabel },
                label,
              ),
              wp.element.createElement(MediaUpload, {
                onSelect: (media) => setAttributes({ [attr]: media.url }),
                allowedTypes: ["application/pdf"],
                value: attributes[attr],
                render: ({ open }) =>
                  wp.element.createElement(
                    "button",
                    { onClick: open, className: "button" },
                    attributes[attr]
                      ? "Change " + label
                      : "Upload " + label,
                  ),
              }),
              attributes[attr] &&
                wp.element.createElement(
                  "span",
                  { style: previewStyles.fileChip },
                  attributes[attr].split("/").pop(),
                ),
            );
          }),
        ),

      showPdfAndLinks &&
        wp.element.createElement(
          "div",
          {
            style: {
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "4px 20px",
            },
          },
          wp.element.createElement("hr", {
            style: {
              flex: 1,
              border: "none",
              borderTop: "1px solid #d0e4eb",
            },
          }),
          wp.element.createElement(
            "span",
            {
              style: {
                fontSize: "11px",
                fontWeight: "700",
                color: "#6b7c84",
                textTransform: "uppercase",
                letterSpacing: "1px",
                whiteSpace: "nowrap",
              },
            },
            "— or use download links instead —",
          ),
          wp.element.createElement("hr", {
            style: {
              flex: 1,
              border: "none",
              borderTop: "1px solid #d0e4eb",
            },
          }),
        ),

      features.downloadLinks &&
        wp.element.createElement(
          "div",
          {
            style: {
              ...previewStyles.uploadArea,
              paddingTop: showPdfAndLinks ? "0" : undefined,
            },
          },
          [
            { label: "English Download Link", attr: "downloadUrlEn" },
            { label: "Spanish Download Link", attr: "downloadUrlEs" },
          ].map(({ label, attr }) =>
            wp.element.createElement(
              "div",
              { key: attr, style: previewStyles.uploadGroup },
              wp.element.createElement(
                "span",
                { style: previewStyles.uploadLabel },
                label,
              ),
              wp.element.createElement("input", {
                type: "text",
                value: attributes[attr],
                onChange: (e) => setAttributes({ [attr]: e.target.value }),
                placeholder: "https://drive.google.com/...",
                style: { width: "100%", padding: "4px 8px", fontSize: "12px" },
              }),
            ),
          ),
        ),
    ),
  );
}
