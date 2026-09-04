import "./style.css";

import { registerBlockType } from "@wordpress/blocks";
import { useBlockProps, RichText, InnerBlocks } from "@wordpress/block-editor";
import { __ } from "@wordpress/i18n";

registerBlockType("custom/read-more", {
  title: __("Read More", "custom-blocks"),
  category: "widgets",

  attributes: {
    buttonLabel: { type: "string", default: "Read More" },
    // Shown once the content is expanded (replaces read-more.js's hardcoded
    // "Read Less" for this block instance). Left blank, the toggle script
    // falls back to "Read Less" on its own — see read-more.js.
    expandedButtonLabel: { type: "string", default: "Read Less" },
  },

  edit: ({ attributes, setAttributes }) => {
    const blockProps = useBlockProps();

    return wp.element.createElement(
      "div",
      blockProps,

      // ── Button Label ─────────────────────────────────────────────────
      // Shown first in the editor so editors see the label before the content zone,
      // even though in the saved HTML the button sits below the expandable content.
      wp.element.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "12px",
          },
        },
        wp.element.createElement(
          "label",
          {
            style: {
              fontSize: "15px",
              fontWeight: "600",
              flexShrink: 0,
            },
          },
          "Button label:",
        ),
        wp.element.createElement(RichText, {
          tagName: "span",
          placeholder: __("Read More", "custom-blocks"),
          value: attributes.buttonLabel,
          onChange: (val) => setAttributes({ buttonLabel: val }),
          style: {
            fontSize: "15px",
            flex: 1,
          },
        }),
      ),

      // ── Expanded Button Label ────────────────────────────────────────
      wp.element.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "12px",
          },
        },
        wp.element.createElement(
          "label",
          {
            style: {
              fontSize: "15px",
              fontWeight: "600",
              flexShrink: 0,
            },
          },
          "Label when expanded:",
        ),
        wp.element.createElement(RichText, {
          tagName: "span",
          placeholder: __("Read Less", "custom-blocks"),
          value: attributes.expandedButtonLabel,
          onChange: (val) => setAttributes({ expandedButtonLabel: val }),
          style: {
            fontSize: "15px",
            flex: 1,
          },
        }),
      ),

      // ── Expandable Content Zone ───────────────────────────────────────
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
          allowedBlocks: [
            "core/paragraph",
            "core/heading",
            "core/list",
            "core/quote",
            "core/image",
            "custom/unfunded-episode",
            "custom/episode",
          ],
          template: [["core/paragraph", {}]],
        }),
      ),
    );
  },

  save: ({ attributes }) => {
    const blockProps = useBlockProps.save();

    return wp.element.createElement(
      "article",
      {
        ...blockProps,
        className: "expandable-article-block",
      },

      // Content is hidden by default; read-more.js toggles the .expanded class
      wp.element.createElement(
        "div",
        { className: "expandable-content" },
        wp.element.createElement(InnerBlocks.Content),
      ),

      wp.element.createElement(
        "button",
        {
          className: "read-more-toggle block-toggle-btn",
          "data-expanded": "false",
          // Per-instance label overrides read by read-more.js; it falls
          // back to its own hardcoded "Read More"/"Read Less" when these
          // are blank (e.g. content saved before this attribute existed).
          "data-label-collapsed": attributes.buttonLabel || "",
          "data-label-expanded": attributes.expandedButtonLabel || "",
          type: "button",
        },
        attributes.buttonLabel || "Read More",
      ),
    );
  },
});
