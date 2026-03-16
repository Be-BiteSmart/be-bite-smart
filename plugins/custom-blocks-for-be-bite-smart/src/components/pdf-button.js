export function renderPdfButton(
  wp,
  base,
  targetId,
  groupId,
  labelView,
  labelHide,
) {
  return wp.element.createElement(
    "button",
    {
      className: base,
      "data-target": targetId,
      "data-group": groupId,
      "data-expanded": "false",
    },
    wp.element.createElement(
      "span",
      { className: "btn-label btn-label--view" },
      labelView,
    ),
    wp.element.createElement(
      "span",
      { className: "btn-label btn-label--hide", style: { display: "none" } },
      labelHide,
    ),
  );
}
