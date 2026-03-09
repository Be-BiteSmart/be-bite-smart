import './style.css';

import { registerBlockType } from '@wordpress/blocks';
import { useBlockProps, RichText, InspectorControls, MediaUpload, MediaUploadCheck } from '@wordpress/block-editor';
import { PanelBody, RadioControl, Button, TextControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

const editor_font_size = "18px";

registerBlockType("custom/news-and-coverage", {
    title: __("News and Coverage", "custom-blocks"),
    category: "widgets",

    supports: {
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
      outletType: { type: "string", default: "text" }, // "text" or "logo"
      outletName: { type: "string", default: "" },
      logoUrl: { type: "string", default: "" },
      logoAlt: { type: "string", default: "" },
      logoId: { type: "number", default: 0 },
      headline: { type: "string", default: "" },
      excerpt: { type: "string", default: "" },
      linkUrl: { type: "string", default: "" },
      linkLabel: { type: "string", default: "Read Full Article" },
    },

    edit: ({ attributes, setAttributes }) => {
      const blockProps = useBlockProps();

      return wp.element.createElement(
        "div",
        blockProps,

        // ── Inspector Controls ──────────────────────────────────────────
        wp.element.createElement(
          InspectorControls,
          null,
          wp.element.createElement(
            PanelBody,
            { title: __("Outlet Display", "custom-blocks") },
            wp.element.createElement(RadioControl, {
              label: __("Show outlet as", "custom-blocks"),
              selected: attributes.outletType,
              options: [
                { label: "Text name", value: "text" },
                { label: "Logo image", value: "logo" },
              ],
              onChange: (val) => setAttributes({ outletType: val }),
            }),
          ),
          wp.element.createElement(
            PanelBody,
            { title: __("Link Settings", "custom-blocks") },
            wp.element.createElement(TextControl, {
              label: __("Link URL", "custom-blocks"),
              value: attributes.linkUrl || "",
              placeholder: "https://example.com/article",
              onChange: (val) => setAttributes({ linkUrl: val }),
            }),
            wp.element.createElement(TextControl, {
              label: __("Link Button Label", "custom-blocks"),
              value: attributes.linkLabel || "",
              placeholder: "Read Full Article",
              onChange: (val) => setAttributes({ linkLabel: val }),
            }),
          ),
        ),

        // ── Outlet Name / Logo ──────────────────────────────────────────
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
                fontSize: editor_font_size,
                fontWeight: "600",
                flexShrink: 0,
              },
            },
            "Media Outlet:",
          ),

          // Text name input
          attributes.outletType === "text"
            ? wp.element.createElement("input", {
                type: "text",
                placeholder: __("e.g., The New York Times", "custom-blocks"),
                value: attributes.outletName || "",
                onChange: (e) => setAttributes({ outletName: e.target.value }),
                style: {
                  flex: 1,
                  padding: "4px 8px",
                  border: "none",
                  backgroundColor: "transparent",
                  fontSize: editor_font_size,
                  outline: "none",
                },
              })
            : // Logo uploader
              wp.element.createElement(
                MediaUploadCheck,
                null,
                wp.element.createElement(MediaUpload, {
                  onSelect: (media) =>
                    setAttributes({
                      logoUrl: media.url,
                      logoAlt: media.alt || "",
                      logoId: media.id,
                    }),
                  allowedTypes: ["image"],
                  value: attributes.logoId,
                  render: ({ open }) =>
                    wp.element.createElement(
                      "div",
                      {
                        style: {
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        },
                      },
                      attributes.logoUrl
                        ? wp.element.createElement("img", {
                            src: attributes.logoUrl,
                            alt: attributes.logoAlt,
                            style: {
                              maxHeight: "40px",
                              maxWidth: "160px",
                              objectFit: "contain",
                            },
                          })
                        : null,
                      wp.element.createElement(
                        Button,
                        {
                          onClick: open,
                          variant: "secondary",
                          style: { fontSize: "13px" },
                        },
                        attributes.logoUrl
                          ? __("Replace Logo", "custom-blocks")
                          : __("Upload Logo", "custom-blocks"),
                      ),
                      attributes.logoUrl
                        ? wp.element.createElement(
                            Button,
                            {
                              onClick: () =>
                                setAttributes({
                                  logoUrl: "",
                                  logoAlt: "",
                                  logoId: 0,
                                }),
                              variant: "tertiary",
                              isDestructive: true,
                              style: { fontSize: "13px" },
                            },
                            __("Remove", "custom-blocks"),
                          )
                        : null,
                    ),
                }),
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
            placeholder: __("Enter article headline", "custom-blocks"),
            value: attributes.headline,
            onChange: (val) => setAttributes({ headline: val }),
            style: {
              fontSize: editor_font_size,
              flex: 1,
              margin: 0,
            },
          }),
        ),

        // ── Excerpt ─────────────────────────────────────────────────────
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
            "Excerpt (1–2 lines):",
          ),
          wp.element.createElement(RichText, {
            tagName: "p",
            placeholder: __("Enter a short excerpt or teaser", "custom-blocks"),
            value: attributes.excerpt,
            onChange: (val) => setAttributes({ excerpt: val }),
            style: {
              fontSize: editor_font_size,
              margin: 0,
            },
          }),
        ),

        // ── Link preview ─────────────────────────────────────────────────
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
            "External Link:",
          ),
          wp.element.createElement(
            "span",
            {
              style: {
                fontSize: "14px",
                color: "#6b7280",
                fontStyle: "italic",
              },
            },
            attributes.linkUrl
              ? attributes.linkUrl
              : __("Set URL in the block settings panel →", "custom-blocks"),
          ),
        ),

        // ── Button label preview ─────────────────────────────────────────
        wp.element.createElement(
          "div",
          {
            style: {
              marginTop: "8px",
              padding: "8px 16px",
              background: "#1e5480",
              color: "#fff",
              display: "inline-block",
              borderRadius: "4px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "default",
              opacity: 0.8,
            },
          },
          attributes.linkLabel || "Read Full Article",
          " ↗",
        ),
      );
    },

    save: ({ attributes }) => {
      const blockProps = useBlockProps.save();

      return wp.element.createElement(
        "article",
        {
          ...blockProps,
          className:
            "custom-block-card custom-block-border          media-mention-block",
        },

        // Outlet badge
        (attributes.outletName || attributes.logoUrl) &&
          wp.element.createElement(
            "div",
            { className: "media-mention-outlet" },
            attributes.outletType === "logo" && attributes.logoUrl
              ? wp.element.createElement("img", {
                  src: attributes.logoUrl,
                  alt: attributes.logoAlt || attributes.outletName || "",
                  className: "media-mention-logo",
                })
              : wp.element.createElement(
                  "span",
                  { className: "media-mention-outlet-name" },
                  attributes.outletName,
                ),
          ),

        // Headline
        attributes.headline &&
          wp.element.createElement(RichText.Content, {
            tagName: "h3",
            value: attributes.headline,
            className: "media-mention-headline",
          }),

        // Excerpt
        attributes.excerpt &&
          wp.element.createElement(RichText.Content, {
            tagName: "p",
            value: attributes.excerpt,
            className: "media-mention-excerpt",
          }),

        // External link button
        attributes.linkUrl &&
          wp.element.createElement(
            "a",
            {
              href: attributes.linkUrl,
              className: "block-toggle-btn",
              target: "_blank",
              rel: "noopener noreferrer",
            },
            attributes.linkLabel || "Read Full Article",
          ),
      );
    },
  });