import "./style.css";

import { registerBlockType } from "@wordpress/blocks";
import { createElement as el } from "@wordpress/element";
import {
  TextControl,
  TextareaControl,
  SelectControl,
} from "@wordpress/components";
import { useBlockProps } from "@wordpress/block-editor";

registerBlockType("custom/unfunded-episode", {
  attributes: {
    episodeNumber: { type: "string", default: "" },
    title: { type: "string", default: "" },
    lesson: { type: "string", default: "" },
    status: { type: "string", default: "Awaiting Development" },
  },

  edit: ({ attributes, setAttributes }) => {
    const blockProps = useBlockProps({ className: "unfunded-episode-card" });

    return el(
      "div",
      blockProps,
      el(
        "div",
        { className: "uec-inner" },

        // Thumbnail
        el(
          "div",
          { className: "uec-thumb" },
          el("span", { className: "uec-thumb-icon" }, "🎬"),
          el("span", { className: "uec-thumb-label" }, attributes.status),
        ),

        // Editor fields + preview
        el(
          "div",
          { className: "uec-body" },
          el(
            "div",
            { className: "uec-fields" },
            el(TextControl, {
              label: "Episode Number",
              placeholder: "e.g. 3",
              value: attributes.episodeNumber,
              onChange: (val) => setAttributes({ episodeNumber: val }),
            }),
            el(TextControl, {
              label: "Title",
              placeholder: "e.g. Never Kiss a Dog on the Face",
              value: attributes.title,
              onChange: (val) => setAttributes({ title: val }),
            }),
            el(TextareaControl, {
              label: "Lesson",
              placeholder: "e.g. Never go face to face with a dog...",
              value: attributes.lesson,
              onChange: (val) => setAttributes({ lesson: val }),
            }),
            el(SelectControl, {
              label: "Status",
              value: attributes.status,
              options: [
                { label: "Awaiting Development", value: "Awaiting Development" },
                { label: "In Development", value: "In Development" },
              ],
              onChange: (val) => setAttributes({ status: val }),
            }),
          ),

          // Live preview
          el(
            "div",
            { className: "uec-preview" },
            el(
              "div",
              { className: "uec-ep-number" },
              attributes.episodeNumber
                ? "Episode " + attributes.episodeNumber
                : "Episode —",
            ),
            el(
              "div",
              { className: "uec-title" },
              attributes.title || "Title Pending",
            ),
            el(
              "div",
              { className: "uec-lesson" },
              attributes.lesson || "Lesson description will appear here.",
            ),
          ),
        ),
      ),
    );
  },

  save: ({ attributes }) => {
    const blockProps = useBlockProps.save({
      className: "unfunded-episode-card",
    });

    return el(
      "article",
      blockProps,
      el(
        "div",
        { className: "uec-inner" },
        el(
          "div",
          { className: "uec-thumb", "aria-hidden": "true" },
          el("span", { className: "uec-thumb-icon" }, "🎬"),
          el("span", { className: "uec-thumb-label" }, attributes.status),
        ),
        el(
          "div",
          { className: "uec-body" },
          el(
            "div",
            { className: "uec-ep-number" },
            attributes.episodeNumber
              ? "Episode " + attributes.episodeNumber
              : "Episode",
          ),
          el(
            "div",
            { className: "uec-title" },
            attributes.title || "Title Pending",
          ),
          el("div", { className: "uec-lesson" }, attributes.lesson),
        ),
      ),
    );
  },
});
