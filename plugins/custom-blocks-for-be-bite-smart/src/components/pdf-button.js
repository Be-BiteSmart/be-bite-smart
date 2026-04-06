export function renderPdfButton(
  wp,
  base,
  targetId,
  groupId,
  labelView,
  labelHide,
  lang,
) {
  return wp.element.createElement(
    "button",
    {
      className: base,
      "data-target": targetId,
      "data-group": groupId,
      "data-expanded": "false",
      "data-lang": lang,
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
