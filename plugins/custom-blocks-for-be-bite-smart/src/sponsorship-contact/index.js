import "./style.css";

import { registerBlockType } from "@wordpress/blocks";
import { useBlockProps, RichText } from "@wordpress/block-editor";
import { TextControl } from "@wordpress/components";
import { createElement as el } from "@wordpress/element";
import { __ } from "@wordpress/i18n";

registerBlockType("custom/sponsorship-contact", {
  title: __("Sponsorship Card", "custom-blocks"),
  category: "widgets",

  attributes: {
    name: { type: "string", default: "" },
    role: { type: "string", default: "Sponsorship & Funding Inquiries" },
    email: { type: "string", default: "" },
    phone: { type: "string", default: "" },
    contactFormUrl: { type: "string", default: "" },
  },

  edit: function ({ attributes, setAttributes }) {
    const blockProps = useBlockProps();

    return el(
      "div",
      blockProps,

      // Name
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

      // Role label
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
          "Role / Inquiry Label",
        ),
        el(RichText, {
          tagName: "p",
          className: "sponsorship-role",
          value: attributes.role,
          onChange: (val) => setAttributes({ role: val }),
          placeholder: __(
            "e.g. Sponsorship & Funding Inquiries",
            "custom-blocks",
          ),
        }),
      ),

      // Email
      el(TextControl, {
        label: __("Email", "custom-blocks"),
        value: attributes.email,
        onChange: (val) => setAttributes({ email: val }),
        placeholder: "email@example.com",
        style: { marginBottom: "1em" },
      }),

      // Phone
      el(TextControl, {
        label: __("Phone", "custom-blocks"),
        value: attributes.phone,
        onChange: (val) => setAttributes({ phone: val }),
        placeholder: "111-111-1111",
        style: { marginBottom: "1em" },
      }),

      // Contact Form URL
      el(TextControl, {
        label: __("Contact Form URL", "custom-blocks"),
        value: attributes.contactFormUrl,
        onChange: (val) => setAttributes({ contactFormUrl: val }),
        placeholder: "https://yoursite.com/contact",
        style: { marginBottom: "1em" },
      }),

      // Preview hint
      el(
        "p",
        { style: { color: "#888", fontSize: "0.8em", fontStyle: "italic" } },
        __(
          "Card will render with the orange accent bar and pill buttons on the front end.",
          "custom-blocks",
        ),
      ),
    );
  },

  save: function ({ attributes }) {
    const blockProps = useBlockProps.save();

    return el(
      "section",
      {
        ...blockProps,
        // custom-block-card — shared card styles (padding, shadow, margin) live in global CSS
        // custom-block-border — shared border styles live in global CSS
        className: `${
          blockProps.className || ""
        } custom-block-card custom-block-border`.trim(),
      },

      // Name
      attributes.name &&
        el(RichText.Content, {
          tagName: "h3",
          className: "sponsorship-card-name",
          value: attributes.name,
        }),

      // Role label
      attributes.role &&
        el(RichText.Content, {
          tagName: "p",
          className: "capitalized-and-colored",
          value: attributes.role,
        }),

      // Email as plain text
      attributes.email &&
        el("p", { className: "sponsorship-card-email" }, attributes.email),

      // Phone as plain text
      attributes.phone &&
        el("p", { className: "sponsorship-card-phone" }, attributes.phone),

      // Buttons

      (attributes.email || attributes.contactFormUrl) &&
        el(
          "div",
          { className: "sponsorship-card-btns" },

          attributes.email &&
            el(
              "a",
              {
                href: "mailto:" + attributes.email,
                className: "block-toggle-btn",
              },
              __("Email", "custom-blocks"),
            ),

          attributes.contactFormUrl &&
            el(
              "a",
              {
                href: attributes.contactFormUrl,
                className: "block-toggle-btn is-style-outline",
              },
              __("Contact Form", "custom-blocks"),
            ),
        ),
    );
  },
});
