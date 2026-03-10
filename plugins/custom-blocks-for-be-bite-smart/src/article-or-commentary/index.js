import './style.css';

import { registerBlockType, createBlock } from '@wordpress/blocks';
import { useBlockProps, RichText, InspectorControls, InnerBlocks } from '@wordpress/block-editor';
import { PanelBody, RadioControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useDispatch } from '@wordpress/data';

const editor_font_size = "18px";
const TEXT_BLOCKS = ["core/paragraph", "core/heading", "core/list", "core/quote", "core/image"];
const ALLOWED_BLOCKS = ["custom/pdf-toggle"];

registerBlockType("custom/article-or-commentary", {
  title: __("Article or Commentary", "custom-blocks"),
  category: "widgets",

    supports: {
      fontSize: true,
      color: {
        background: true,
        text: true,
      },
      spacing: {
        margin: true,
        padding: true,
      },
    },

    attributes: {
      headline: { type: "string", default: "" },
      author: { type: "string", default: "" },
      date: { type: "string", default: "" },
      introParagraph: { type: "string", default: "" },
      articleId: { type: "string", default: "" },
      contentType: { type: "string", default: "text" },
      // fullText removed — content now lives in InnerBlocks ["core/paragraph", "core/heading", "core/list", "core/quote", "core/image"];
    },

    edit: ({ attributes, setAttributes, clientId }) => {
      const blockProps = useBlockProps();
      const { replaceInnerBlocks } = useDispatch("core/block-editor");

      // When the user switches content type, clear inner blocks and
      // insert the correct starting template for the new mode.
      // NOTE: switching modes clears any content already entered.
      const handleContentTypeChange = (val) => {
        setAttributes({ contentType: val });

        if (val === "text") {
          replaceInnerBlocks(
            clientId,
            [createBlock("core/paragraph", {})],
            false,
          );
        } else {
          // "pdf" — swap in the pdf-toggle block
          replaceInnerBlocks(
            clientId,
            [createBlock("custom/pdf-toggle", {})],
            false,
          );
        }
      };

      return wp.element.createElement(
        "div",
        blockProps,

        // ── Inspector Controls ──────────────────────────────────────────
        wp.element.createElement(
          InspectorControls,
          null,
          wp.element.createElement(
            PanelBody,
            { title: __("Content Settings", "custom-blocks") },
            wp.element.createElement(RadioControl, {
              label: __("Expandable Content Type", "custom-blocks"),
              selected: attributes.contentType,
              options: [
                { label: "Full Text", value: "text" },
                { label: "PDF", value: "pdf" },
              ],
              onChange: handleContentTypeChange,
            }),
            attributes.contentType === "text" &&
              wp.element.createElement(
                "p",
                {
                  style: {
                    fontSize: "12px",
                    color: "#6b7280",
                    marginTop: "8px",
                  },
                },
                "Paste or type your full text below. Bold, italics, headings, and lists are supported.",
              ),
          ),
        ),

        // ── Headline ────────────────────────────────────────────────────
        wp.element.createElement(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "10px",
            },
          },
          wp.element.createElement(
            "label",
            {
              style: {
                fontSize: editor_font_size,
                fontWeight: "600",
                flexShrink: 0,
              },
            },
            "Headline:",
          ),
          wp.element.createElement(RichText, {
            tagName: "h3",
            placeholder: __("Enter headline", "custom-blocks"),
            value: attributes.headline,
            onChange: (val) => setAttributes({ headline: val }),
            style: {
              fontSize: editor_font_size,
              flex: 1,
              margin: 0,
            },
          }),
        ),

        // ── Author ──────────────────────────────────────────────────────
        wp.element.createElement(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "10px",
            },
          },
          wp.element.createElement(
            "label",
            {
              style: {
                fontSize: editor_font_size,
                fontWeight: "600",
                flexShrink: 0,
              },
            },
            "Author:",
          ),
          wp.element.createElement("input", {
            type: "text",
            placeholder: __("Author name", "custom-blocks"),
            value: attributes.author || "",
            onChange: (e) => setAttributes({ author: e.target.value }),
            style: {
              flex: 1,
              padding: "4px 8px",
              border: "none",
              backgroundColor: "transparent",
              fontSize: editor_font_size,
              outline: "none",
            },
          }),
        ),

        // ── Date ────────────────────────────────────────────────────────
        wp.element.createElement(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "10px",
            },
          },
          wp.element.createElement(
            "label",
            {
              style: {
                fontSize: editor_font_size,
                fontWeight: "600",
                flexShrink: 0,
              },
            },
            "Date:",
          ),
          wp.element.createElement("input", {
            type: "date",
            value: attributes.date || "",
            onChange: (e) => setAttributes({ date: e.target.value }),
            style: {
              flex: 1,
              padding: "4px 8px",
              border: "none",
              backgroundColor: "transparent",
              fontSize: editor_font_size,
              outline: "none",
            },
          }),
        ),

        // ── Article ID ──────────────────────────────────────────────────
        wp.element.createElement(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "10px",
            },
          },
          wp.element.createElement(
            "label",
            {
              style: {
                fontSize: editor_font_size,
                fontWeight: "600",
                flexShrink: 0,
              },
            },
            "Article ID:",
          ),
          wp.element.createElement("input", {
            type: "text",
            placeholder: __("e.g., article-1 (for linking)", "custom-blocks"),
            value: attributes.articleId || "",
            onChange: (e) => setAttributes({ articleId: e.target.value }),
            style: {
              flex: 1,
              padding: "4px 8px",
              border: "none",
              backgroundColor: "transparent",
              fontSize: editor_font_size,
              outline: "none",
            },
          }),
        ),

        // ── Intro Paragraph ─────────────────────────────────────────────
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
                marginBottom: "5px",
              },
            },
            "Intro Paragraph:",
          ),
          wp.element.createElement(RichText, {
            tagName: "p",
            placeholder: __("Enter intro paragraph", "custom-blocks"),
            value: attributes.introParagraph,
            onChange: (val) => setAttributes({ introParagraph: val }),
            style: {
              fontSize: editor_font_size,
              margin: 0,
            },
          }),
        ),

        // ── Expandable InnerBlocks (text or pdf) ─────────────────────────
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
                marginBottom: "8px",
              },
            },
            attributes.contentType === "pdf"
              ? "PDF Toggle Block:"
              : "Full Text (expandable):",
          ),
          wp.element.createElement(
            "div",
            {
              style: {
                border: "1px dashed #aaa",
                padding: "10px",
                borderRadius: "4px",
              },
            },
            wp.element.createElement(InnerBlocks, {
              allowedBlocks:
                attributes.contentType === "pdf" ? ALLOWED_BLOCKS : TEXT_BLOCKS,
              template:
                attributes.contentType === "pdf"
                  ? [["custom/pdf-toggle", {}]]
                  : [["core/paragraph", {}]],
              templateLock:
                attributes.contentType === "pdf" ? "all" : false,
            }),
          ),
        ),
      );
    },

    save: ({ attributes }) => {
      const blockProps = useBlockProps.save();

      return wp.element.createElement(
        "article",
        {
          ...blockProps,
          // custom-block-card — shared card styles (border, shadow, padding) live in global CSS
          className:
            "expandable-article-block custom-block-card custom-block-border",
          id: attributes.articleId || undefined,
        },

        // ── Headline ─────────────────────────────────────────────────────
        attributes.headline &&
          wp.element.createElement(RichText.Content, {
            tagName: "h3",
            value: attributes.headline,
            className: "article-headline",
          }),

        // ── Author & Date ─────────────────────────────────────────────────
        wp.element.createElement(
          "div",
          { className: "article-meta" },
          attributes.author &&
            wp.element.createElement(
              "span",
              { className: "article-author" },
              attributes.author,
            ),
          attributes.author &&
            attributes.date &&
            wp.element.createElement("span", null, " • "),
          attributes.date &&
            wp.element.createElement(
              "span",
              { className: "article-date" },
              attributes.date,
            ),
        ),

        // ── Intro Paragraph ───────────────────────────────────────────────
        attributes.introParagraph &&
          wp.element.createElement(RichText.Content, {
            tagName: "p",
            value: attributes.introParagraph,
            className: "article-intro",
          }),

        // ── Expandable InnerBlocks (text or pdf) ──────────────────────────
        // Both modes now use InnerBlocks.Content — the text branch wraps it
        // in expandable-content with a Read More toggle button, the pdf
        // branch renders the pdf-toggle block directly.
        attributes.contentType === "text"
          ? wp.element.createElement(
              "div",
              null,
              wp.element.createElement(
                "div",
                {
                  // expandable-content base styles live in global CSS
                  className: "expandable-content",
                },
                wp.element.createElement(InnerBlocks.Content),
              ),
              wp.element.createElement(
                "button",
                {
                  className: "read-more-toggle block-toggle-btn",
                  "data-expanded": "false",
                  type: "button",
                },
                "Read More",
              ),
            )
          : wp.element.createElement(InnerBlocks.Content),
      );
    },
  });