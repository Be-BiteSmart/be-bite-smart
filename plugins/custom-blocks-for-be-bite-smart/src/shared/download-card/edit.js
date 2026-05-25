import {
  useBlockProps,
  InspectorControls,
  MediaUpload,
  RichText,
} from "@wordpress/block-editor";
import { PanelBody } from "@wordpress/components";
import { previewStyles } from "./preview-styles";

export function DownloadCardEdit({ attributes, setAttributes, clientId, config }) {
  const blockProps = useBlockProps();
  const { blockIdPrefix, features, editorHelp } = config;
  const wp = window.wp;

  wp.element.useEffect(() => {
    if (!attributes.blockId) {
      setAttributes({ blockId: blockIdPrefix + "-" + clientId.slice(0, 8) });
    }
  }, []);

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
