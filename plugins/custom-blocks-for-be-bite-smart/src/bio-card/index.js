import './style.css';

import { registerBlockType, createBlock } from '@wordpress/blocks';
import { useBlockProps, RichText, MediaUpload, MediaUploadCheck, InnerBlocks } from '@wordpress/block-editor';
import { Button, TextControl } from '@wordpress/components';
import { createElement as el } from '@wordpress/element';
import { __ } from '@wordpress/i18n';


const EXPANDED_BIO_BLOCKS =  ["core/paragraph", "core/heading", "core/list", "core/quote", "core/image"];

registerBlockType("custom/bio-card", {
    title: __("Bio Card", "custom-blocks"),
    category: "widgets",

    attributes: {
      photoId: { type: "number" },
      photoUrl: { type: "string" },
      name: { type: "string", default: "" },
      role: { type: "string", default: "" },
      affiliation: { type: "string", default: "" },
      personalEmail: { type: "string", default: "" },
      professionalEmail: { type: "string", default: "" },
      linkedIn: { type: "string", default: "" },
      shortBio: { type: "string", default: "" },
   // ── Expanded Bio (InnerBlocks — paragraph, heading, list, quote, image) ───
    },

    edit: function ({ attributes, setAttributes }) {
      const blockProps = useBlockProps();

      return el(
        "div",
        blockProps,

        // ── Photo ───────────────────────────────────────────────────────
        attributes.photoUrl &&
          el("img", {
            src: attributes.photoUrl,
            alt: "",
            style: {
              height: "300px",
              flexShrink: 0,
            },
          }),

        // ── Content wrapper ─────────────────────────────────────────────
        el(
          "div",
          null,

          // Photo upload button
          el(
            MediaUploadCheck,
            {},
            el(MediaUpload, {
              onSelect: (media) =>
                setAttributes({ photoUrl: media.url, photoId: media.id }),
              allowedTypes: ["image"],
              value: attributes.photoId,
              render: ({ open }) =>
                el(
                  Button,
                  {
                    onClick: open,
                    variant: "primary",
                    style: { marginBottom: "1em" },
                  },
                  attributes.photoUrl
                    ? __("Change Photo", "custom-blocks")
                    : __("Upload Photo", "custom-blocks"),
                ),
            }),
          ),

          // ── Name ──────────────────────────────────────────────────────
          el(
            "div",
            { style: { marginBottom: "1em" } },
            el(
              "label",
              {
                style: {
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "0.25em",
                },
              },
              "Name",
            ),
            el(RichText, {
              tagName: "p",
              value: attributes.name,
              onChange: (val) => setAttributes({ name: val }),
              placeholder: __(
                "Name (can include credentials)",
                "custom-blocks",
              ),
            }),
          ),

          // ── Role ──────────────────────────────────────────────────────
          el(
            "div",
            { style: { marginBottom: "1em" } },
            el(
              "label",
              {
                style: {
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "0.25em",
                },
              },
              "Role",
            ),
            el(RichText, {
              tagName: "p",
              className: "bio-role ",
              value: attributes.role,
              onChange: (val) => setAttributes({ role: val }),
              placeholder: __("Role", "custom-blocks"),
            }),
          ),

          // ── Affiliation ───────────────────────────────────────────────
          el(
            "div",
            { style: { marginBottom: "1em" } },
            el(
              "label",
              {
                style: {
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "0.25em",
                },
              },
              "Affiliation",
            ),
            el(RichText, {
              tagName: "p",
              className: "bio-affiliation",
              value: attributes.affiliation,
              onChange: (val) => setAttributes({ affiliation: val }),
              placeholder: __("Affiliation (optional)", "custom-blocks"),
            }),
          ),

          // ── Professional Email ─────────────────────────────────────────
          el(
            "div",
            { style: { marginBottom: "1em" } },
            el(
              "label",
              {
                style: {
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "0.25em",
                },
              },
              "Professional Email (To field)",
            ),
            el(TextControl, {
              value: attributes.professionalEmail,
              onChange: (val) => setAttributes({ professionalEmail: val }),
              placeholder: __("Professional email", "custom-blocks"),
            }),
          ),

          // ── Personal Email ────────────────────────────────────────────
          el(
            "div",
            { style: { marginBottom: "1em" } },
            el(
              "label",
              {
                style: {
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "0.25em",
                },
              },
              "Personal Email (CC field, optional)",
            ),
            el(TextControl, {
              value: attributes.personalEmail,
              onChange: (val) => setAttributes({ personalEmail: val }),
              placeholder: __("Personal email", "custom-blocks"),
            }),
          ),

          // ── LinkedIn ──────────────────────────────────────────────────
          el(
            "div",
            { style: { marginBottom: "1em" } },
            el(
              "label",
              {
                style: {
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "0.25em",
                },
              },
              "LinkedIn URL",
            ),
            el(TextControl, {
              value: attributes.linkedIn,
              onChange: (val) => setAttributes({ linkedIn: val }),
              placeholder: __("LinkedIn URL (optional)", "custom-blocks"),
            }),
          ),

          // ── Short Bio ─────────────────────────────────────────────────
          el(
            "div",
            { style: { marginBottom: "1em" } },
            el(
              "label",
              {
                style: {
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "0.25em",
                },
              },
              "Short Bio",
            ),
            el(RichText, {
              tagName: "div",
              className: "bio-short",
              value: attributes.shortBio,
              onChange: (val) => setAttributes({ shortBio: val }),
              placeholder: __("Short Bio", "custom-blocks"),
            }),
          ),

          // ── Expanded Bio (InnerBlocks / core/freeform) ─────────────────
          // Replaces the old expandedBio RichText attribute so editors get
          // the full classic toolbar: bold, italics, headings, lists, etc.
          // NOTE: switching from an old saved expandedBio value will require
          // "Attempt Block Recovery" in the editor for existing blocks.
          el(
            "div",
            { style: { marginBottom: "1em" } },
            el(
              "label",
              {
                style: {
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "0.25em",
                },
              },
              "Expanded Bio",
            ),
            el(
              "div",
              {
                style: {
                  border: "1px dashed #aaa",
                  padding: "10px",
                  borderRadius: "4px",
                },
              },
              el(InnerBlocks, {
                allowedBlocks: EXPANDED_BIO_BLOCKS,
                template: [["core/paragraph", {}]],
                templateLock: false,
              }),
            ),
          ),
        ),
      );
    },

    save: function ({ attributes }) {
      const blockProps = useBlockProps.save();

      return el(
        "div",
        {
          ...blockProps,
          // custom-block-card — shared card styles (padding, shadow, margin) live in global CSS
          // custom-block-border — shared border styles live in global CSS
          className:
            "wp-block-custom-bio-card custom-block-card custom-block-border",
        },

        el(
          "div",
          { className: "bio-main" },

          // ── Section 1 — photo + details side by side ───────────────────
          el(
            "div",
            { className: "bio-section-1" },

            // Photo
            attributes.photoUrl &&
              el("img", {
                src: attributes.photoUrl,
                alt: attributes.name || "",
              }),

            // Details
            el(
              "div",
              { className: "bio-details" },
              attributes.name && el("h3", null, attributes.name),
              attributes.role &&
                el(RichText.Content, {
                  tagName: "p",
                  className: "bio-role capitalized-and-colored",
                  value: attributes.role,
                }),
              attributes.affiliation &&
                el(RichText.Content, {
                  tagName: "p",
                  className: "bio-affiliation",
                  value: attributes.affiliation,
                }),

              // Email as text
              attributes.professionalEmail &&
                el(
                  "span",
                  { className: "bio-email-display" },
                  el("span", null, attributes.professionalEmail),
                ),

              // Contact links
              (attributes.linkedIn || attributes.professionalEmail) &&
                el(
                  "div",
                  { className: "bio-contact-links" },

                  attributes.professionalEmail &&
                    el(
                      "a",
                      {
                        href:
                          "mailto:" +
                          attributes.professionalEmail +
                          (attributes.personalEmail
                            ? "?cc=" + attributes.personalEmail
                            : ""),
                        className: "block-toggle-btn",
                      },
                      el("span", { className: "message-icon-wrapper" }, null),
                      el("span", null, "Message"),
                    ),

                  attributes.linkedIn &&
                    el(
                      "a",
                      {
                        href: attributes.linkedIn,
                        className: "block-toggle-btn is-style-outline",
                        target: "_blank",
                        rel: "noopener noreferrer",
                      },
                      el("span", { className: "linkedin-icon-wrapper" }, null),
                      el("span", null, "LinkedIn"),
                    ),
                ),

              // Short bio
              attributes.shortBio &&
                el(RichText.Content, {
                  tagName: "div",
                  className: "bio-short",
                  value: attributes.shortBio,
                }),

              // Show More button — always rendered since expanded bio now
              // lives in InnerBlocks and we can't conditionally check its
              // content at save time. Hide via CSS if InnerBlocks is empty.
              el(
                "button",
                {
                  className: "expanded-bio-toggle show-more-btn",
                },
                el("span", null, "Read Full Biography"),
                el("span", { className: "bio-chevron" }, null),
              ),
            ),
          ),

          // ── Section 2 — expanded bio only ─────────────────────────────
       
          el(
            "div",
            { className: "bio-section-2 expanded-bio-content" },
            el(InnerBlocks.Content),
            el(
              "button",
              {
                className: "expanded-bio-toggle show-less-btn",
              },
              el("span", null, "Collapse Biography"),
              el("span", { className: "bio-chevron" }, null),
            ),
          ),
        ),
      );
    },
  });