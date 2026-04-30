export function renderPdfButton(
  wp,
  base,
  targetId,
  groupId,
  labelView,
  labelHide,
  lang,
  extraProps = {},
) {
  return wp.element.createElement(
    "button",
    {
      className: base,
      "data-target": targetId,
      "data-group": groupId,
      "data-expanded": "false",
      "data-lang": lang,
      ...extraProps,
    },
    wp.element.createElement(
      "span",
      { className: "btn-label btn-label--view" },
      labelView,
    ),
    wp.element.createElement(
      "span",
      { className: "btn-label btn-label--hide" },
      labelHide,
    ),
  );
}
