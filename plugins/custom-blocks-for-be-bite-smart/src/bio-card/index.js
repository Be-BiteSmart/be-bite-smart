import "./style.css";

import { registerBlockType, createBlock } from "@wordpress/blocks";
import {
  useBlockProps,
  RichText,
  MediaUpload,
  MediaUploadCheck,
  InnerBlocks,
} from "@wordpress/block-editor";
import { Button, TextControl } from "@wordpress/components";
import { createElement as el } from "@wordpress/element";
import { __ } from "@wordpress/i18n";

const EXPANDED_BIO_BLOCKS = [
  "core/paragraph",
  "core/heading",
  "core/list",
  "core/quote",
  "core/image",
];

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
            placeholder: __("Name (can include credentials)", "custom-blocks"),
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

  /* Why your other attributes work fine but innerBlocks needs special handling: 
  
  fields like name, role, shortBio, etc. are stored as block attributes in the block comment delimiter (<!-- wp:custom/bio-card {"name":"..."} -->), so they survive a null save just fine. InnerBlocks content is different — it lives as actual HTML between the delimiters, which only gets written if save emits InnerBlocks.Content.*/

  save: function () {
    return el(InnerBlocks.Content, {});
  },
});
