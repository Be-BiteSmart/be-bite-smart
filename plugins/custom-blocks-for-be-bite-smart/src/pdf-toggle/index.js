import "./style.css";

import { registerBlockType } from "@wordpress/blocks";
import {
  useBlockProps,
  InspectorControls,
  MediaUpload,
} from "@wordpress/block-editor";
import { PanelBody, TextControl } from "@wordpress/components";
import { __ } from "@wordpress/i18n";
import { renderPdfButton } from "../components/pdf-button";

const editor_font_size = "18px";

registerBlockType("custom/pdf-toggle", {
  title: __("PDF Toggle", "custom-blocks"),
  category: "widgets",

  supports: {
    spacing: { margin: true, padding: true },
  },

  attributes: {
    blockId: { type: "string", default: "" },
    pdfUrl: { type: "string", default: "" },
    pdfUrlEs: { type: "string", default: "" },
  },

  edit: ({ attributes, setAttributes, clientId }) => {
    const blockProps = useBlockProps();

    // Auto-generate a unique blockId on first insert, this way the pdf for episode 2 show under episode 2, versus showing in the pdf section for episode 1
    // clientId is a unique ID WordPress assigns to every block instance automatically, we're just slicing the first 8 characters to keep it readable.
    wp.element.useEffect(() => {
      if (!attributes.blockId) {
        setAttributes({ blockId: "pdf-" + clientId.slice(0, 8) });
      }
    }, []);

    return wp.element.createElement(
      "div",
      blockProps,

      wp.element.createElement(
        InspectorControls,
        null,
        wp.element.createElement(
          PanelBody,
          { title: __("PDF Settings", "custom-blocks") },
          wp.element.createElement(TextControl, {
            label: __("Block ID (for anchor linking)", "custom-blocks"),
            value: attributes.blockId,
            onChange: (val) => setAttributes({ blockId: val }),
            placeholder: "e.g. my-pdf-block",
          }),
        ),
      ),

      wp.element.createElement(
        "div",
        { style: { marginBottom: "15px" } },
        wp.element.createElement(
          "label",
          {
            style: {
              display: "block",
              fontSize: editor_font_size,
              fontWeight: "600",
              marginBottom: "10px",
            },
          },
          "PDF Files:",
        ),

        // English PDF
        wp.element.createElement(
          "div",
          { style: { marginBottom: "10px" } },
          wp.element.createElement(
            "strong",
            { style: { display: "block", marginBottom: "5px" } },
            "English:",
          ),
          wp.element.createElement(MediaUpload, {
            onSelect: (media) => setAttributes({ pdfUrl: media.url }),
            allowedTypes: ["application/pdf"],
            value: attributes.pdfUrl,
            render: ({ open }) =>
              wp.element.createElement(
                "button",
                { onClick: open, className: "button button-large" },
                attributes.pdfUrl ? "Change English PDF" : "Upload English PDF",
              ),
          }),
          attributes.pdfUrl &&
            wp.element.createElement(
              "div",
              {
                style: {
                  padding: "8px 10px",
                  backgroundColor: "#f0f0f0",
                  borderRadius: "4px",
                  fontSize: "13px",
                  marginTop: "8px",
                },
              },
              wp.element.createElement(
                "a",
                {
                  href: attributes.pdfUrl,
                  target: "_blank",
                  rel: "noopener noreferrer",
                  style: { color: "#2271b1", wordBreak: "break-all" },
                },
                attributes.pdfUrl.split("/").pop(),
              ),
            ),
        ),

        // Spanish PDF
        wp.element.createElement(
          "div",
          null,
          wp.element.createElement(
            "strong",
            { style: { display: "block", marginBottom: "5px" } },
            "Spanish:",
          ),
          wp.element.createElement(MediaUpload, {
            onSelect: (media) => setAttributes({ pdfUrlEs: media.url }),
            allowedTypes: ["application/pdf"],
            value: attributes.pdfUrlEs,
            render: ({ open }) =>
              wp.element.createElement(
                "button",
                { onClick: open, className: "button button-large" },
                attributes.pdfUrlEs
                  ? "Change Spanish PDF"
                  : "Upload Spanish PDF",
              ),
          }),
          attributes.pdfUrlEs &&
            wp.element.createElement(
              "div",
              {
                style: {
                  padding: "8px 10px",
                  backgroundColor: "#f0f0f0",
                  borderRadius: "4px",
                  fontSize: "13px",
                  marginTop: "8px",
                },
              },
              wp.element.createElement(
                "a",
                {
                  href: attributes.pdfUrlEs,
                  target: "_blank",
                  rel: "noopener noreferrer",
                  style: { color: "#2271b1", wordBreak: "break-all" },
                },
                attributes.pdfUrlEs.split("/").pop(),
              ),
            ),
        ),
      ),
    );
  },

  save: ({ attributes }) => {
    const blockProps = useBlockProps.save();
    const groupId = "pdf-group-" + (attributes.blockId || "block");
    const enId = "pdf-en-" + (attributes.blockId || "block");
    const esId = "pdf-es-" + (attributes.blockId || "block");

    if (!attributes.pdfUrl && !attributes.pdfUrlEs) return null;

    //{ ...blockProps, className: "pdf-toggle-block" } spreading all of blockProps first, then immediately overwriting the className property with just "pdf-toggle-block" — so WordPress's generated class is gone. We don't want this, it would technically still work visually in most cases, but you'd be quietly breaking things WordPress expects to be there — things like block gap support, spacing presets, and the link between the block and its registered stylesheet. It's just safer to keep both.

    // (blockProps.className ? blockProps.className + " " : "") + "pdf-toggle-block",
    // This says: if blockProps already has a className, keep it and add a space before appending mine. If it doesn't, just use mine. So we get both the wordpress generated classes and mine.

    //the buttons are pdf-toggle, so pdf-toggle-block just makes it clear it's the block-level container

    return wp.element.createElement(
      "div",
      {
        ...blockProps,
        className:
          (blockProps.className ? blockProps.className + " " : "") +
          "pdf-toggle-block",
      },

      // ── Buttons row ──────────────────────────────────────────────────
      // Each language gets a view+download pair wrapped in a Fragment so
      // they stay grouped together in the row, while the iframes sit
      // outside at full width below.
      wp.element.createElement(
        "div",
        { className: "pdf-toggle-buttons" },

        // English row
        attributes.pdfUrl &&
          wp.element.createElement(
            "div",
            { className: "pdf-toggle-language-row" },
            renderPdfButton(
              wp,
              "pdf-toggle block-toggle-btn",
              enId,
              groupId,
              "View PDF (ENG)",
              "Hide PDF (ENG)",
              "en",
              { "data-testid": `pdf-btn-en-${attributes.blockId}` },
            ),
            wp.element.createElement(
              "a",
              {
                href: attributes.pdfUrl,
                download: true,
                className: "block-toggle-btn is-style-outline",
              },
              "Download (ENG)",
            ),
          ),

        // Spanish row
        attributes.pdfUrlEs &&
          wp.element.createElement(
            "div",
            { className: "pdf-toggle-language-row" },
            renderPdfButton(
              wp,
              "pdf-toggle block-toggle-btn",
              esId,
              groupId,
              "View PDF (ES)",
              "Hide PDF (ES)",
              "es",
              { "data-testid": `pdf-btn-es-${attributes.blockId}` },
            ),
            wp.element.createElement(
              "a",
              {
                href: attributes.pdfUrlEs,
                download: true,
                className: "block-toggle-btn is-style-outline",
              },
              "Download (ES)",
            ),
          ),
      ),

      // English viewer
      attributes.pdfUrl &&
        wp.element.createElement(
          "div",
          {
            id: enId,
            className: "pdf-viewer-container",
            "data-testid": `pdf-viewer-en-${attributes.blockId}`,
          },
          wp.element.createElement("iframe", {
            "data-src": attributes.pdfUrl,
            width: "100%",
            height: "600px",
            style: { border: "1px solid #ddd", marginTop: "10px" },
            title: "PDF Document (ENG)",
          }),
        ),

      // Spanish viewer
      attributes.pdfUrlEs &&
        wp.element.createElement(
          "div",
          {
            id: esId,
            className: "pdf-viewer-container",
            "data-testid": `pdf-viewer-es-${attributes.blockId}`,
          },
          wp.element.createElement("iframe", {
            "data-src": attributes.pdfUrlEs,
            width: "100%",
            height: "600px",
            style: { border: "1px solid #ddd", marginTop: "10px" },
            title: "PDF Document (ES)",
          }),
        ),
    );
  },
});
