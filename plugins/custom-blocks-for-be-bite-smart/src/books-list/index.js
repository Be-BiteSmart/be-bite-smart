import { registerBlockType } from "@wordpress/blocks";
import { createElement as el, useMemo } from "@wordpress/element";
import { useBlockProps } from "@wordpress/block-editor";
import { useSelect } from "@wordpress/data";
import { SelectControl, Button, Spinner } from "@wordpress/components";
import ServerSideRender from "@wordpress/server-side-render";
import { decodeEntities } from "@wordpress/html-entities";
import { __ } from "@wordpress/i18n";

// Plain inline SVGs, not @wordpress/icons — that package isn't one of the
// WordPress packages this build externalizes to a core `wp.*` global (it's
// in dependency-extraction-webpack-plugin's own BUNDLED_PACKAGES list), so
// using it would mean adding a new real dependency just for two arrows.
// A hand-rolled SVG has no such dependency and, as a bonus, has no
// Dashicons-webfont issue to worry about either (see the comment below).
const ARROW_UP_ICON = el(
  "svg",
  { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", width: 20, height: 20, "aria-hidden": "true", focusable: "false" },
  el("path", { fill: "currentColor", d: "M12 4l-8 8h5v8h6v-8h5z" }),
);
const ARROW_DOWN_ICON = el(
  "svg",
  { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", width: 20, height: 20, "aria-hidden": "true", focusable: "false" },
  el("path", { fill: "currentColor", d: "M12 20l-8-8h5V4h6v8h5z" }),
);

// Redesigned 2026-08-30 (see books-list.php's file header for the full
// "why"): each instance of this block shows only the Books tagged with ONE
// Audience group, picked below — same "one instance per X, chosen from a
// dropdown" placement idiom as custom/learning-search's own Stage picker
// (see that block's index.js). An editor places one instance per group on
// the Books page, with their OWN ordinary Heading block above each ("For
// Younger Children" etc.) — fully separate, editable/reorderable/removable
// page content, nothing to do with this block at all. That's the point:
// this block used to bake its own headings in (even briefly as an
// overridable attribute), which Janet flagged as still feeling "integrated
// with the block" rather than truly free content.
//
// Book order within one instance's list (added later the same day, per
// Janet — she wanted to be able to set it while editing the page itself,
// not by opening each Book individually) is a real block attribute here
// (`order`, an array of Book IDs), edited via the up/down list below —
// deliberately placed directly in this block's own visible editing area,
// not tucked inside the Inspector settings sidebar, for the same
// discoverability reason the Audience picker already lives here instead of
// there.

// Keep in sync with bitesmart_books_list_audience_groups() in books-list.php
// — this is editor-UI-only signage (which group is this instance showing),
// never rendered on the front end.
const AUDIENCE_OPTIONS = [
  { label: __("— Select an Audience group —", "custom-blocks"), value: "" },
  { label: __("Younger Children", "custom-blocks"), value: "younger_children" },
  { label: __("Older Children", "custom-blocks"), value: "older_children" },
  { label: __("Adults", "custom-blocks"), value: "adult" },
  { label: __("All Ages (With Guidance)", "custom-blocks"), value: "all_ages" },
];

function BooksListEdit({ attributes, setAttributes }) {
  const blockProps = useBlockProps();
  const { audience, order } = attributes;

  // Every published Book tagged with this instance's Audience, alphabetical
  // by title — same query shape (post type, status, meta filter) as
  // bitesmart_build_books_list_cards() in books-list.php, just fetched over
  // REST here so the editor's reorder list can show real titles without a
  // round trip through ServerSideRender's own HTML. null while loading.
  const books = useSelect(
    (select) => {
      if (!audience) {
        return null;
      }
      const records = select("core").getEntityRecords("postType", "book", {
        status: "publish",
        per_page: -1,
        orderby: "title",
        order: "asc",
      });
      if (!records) {
        return null; // still resolving
      }
      return records.filter((book) => (book.meta?._bitesmart_book_audience || "all_ages") === audience);
    },
    [audience],
  );

  // Applies the stored 'order' attribute over the alphabetical REST result —
  // deliberately mirrors bitesmart_books_list_apply_order() in
  // books-list.php exactly (explicitly ordered books first, in that
  // sequence; anything not yet placed — a brand-new Book, or every book the
  // first time this list is touched — appended afterward in its existing
  // alphabetical order), so what an editor sees here always matches what
  // the front end will actually show.
  const orderedBooks = useMemo(() => {
    if (!books) {
      return [];
    }
    const byId = new Map(books.map((book) => [book.id, book]));
    const placed = new Set();
    const result = [];
    (order || []).forEach((id) => {
      if (byId.has(id) && !placed.has(id)) {
        result.push(byId.get(id));
        placed.add(id);
      }
    });
    books.forEach((book) => {
      if (!placed.has(book.id)) {
        result.push(book);
      }
    });
    return result;
  }, [books, order]);

  // Moving a row materializes the FULL current sequence into 'order' (not
  // just a partial override) — simplest predictable behavior: once an
  // editor touches the list once, it stays exactly as arranged. A book
  // published later still isn't in that saved list, so it keeps appending
  // at the end (see bitesmart_books_list_apply_order()) until manually moved.
  const moveBook = (index, direction) => {
    const newOrder = orderedBooks.map((book) => book.id);
    const target = index + direction;
    if (target < 0 || target >= newOrder.length) {
      return;
    }
    [newOrder[index], newOrder[target]] = [newOrder[target], newOrder[index]];
    setAttributes({ order: newOrder });
  };

  return el(
    "div",
    blockProps,
    el(SelectControl, {
      label: __("Audience group", "custom-blocks"),
      value: audience,
      options: AUDIENCE_OPTIONS,
      onChange: (value) => setAttributes({ audience: value }),
      help: __(
        "Place your own Heading block above this one for the group's title — this block only lists the matching Books.",
        "custom-blocks",
      ),
    }),

    audience &&
      el(
        "div",
        { style: { marginTop: "12px" } },
        el("p", { style: { fontWeight: 600, marginBottom: 4 } }, __("Book Order", "custom-blocks")),
        books === null &&
          el(
            "p",
            { className: "components-base-control__help", style: { display: "flex", alignItems: "center", gap: "6px" } },
            el(Spinner),
            __("Loading books…", "custom-blocks"),
          ),
        books !== null &&
          orderedBooks.length === 0 &&
          el(
            "p",
            { className: "components-base-control__help" },
            __("No published Books are tagged with this Audience yet.", "custom-blocks"),
          ),
        orderedBooks.length > 0 &&
          // ARROW_UP_ICON/ARROW_DOWN_ICON above, not Dashicon strings like
          // "arrow-up-alt2" — a block's own edit() UI renders inside the
          // editor's iframe (WP 5.9+), which doesn't load the Dashicons
          // webfont, so a string icon here exists in the DOM but draws
          // nothing (this was the original bug: buttons present, invisible).
          el(
            "ul",
            { style: { listStyle: "none", margin: 0, padding: 0 } },
            ...orderedBooks.map((book, index) =>
              el(
                "li",
                {
                  key: book.id,
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "4px 0",
                    borderBottom: "1px solid #e0e0e0",
                  },
                },
                el(Button, {
                  icon: ARROW_UP_ICON,
                  label: __("Move up", "custom-blocks"),
                  onClick: () => moveBook(index, -1),
                  disabled: index === 0,
                  size: "small",
                }),
                el(Button, {
                  icon: ARROW_DOWN_ICON,
                  label: __("Move down", "custom-blocks"),
                  onClick: () => moveBook(index, 1),
                  disabled: index === orderedBooks.length - 1,
                  size: "small",
                }),
                el(
                  "span",
                  { style: { marginLeft: "4px" } },
                  // REST returns title.rendered HTML-entity-encoded (e.g.
                  // "&#8217;", "&amp;") — fine when dropped into real HTML via
                  // ServerSideRender/dangerouslySetInnerHTML elsewhere, but
                  // this is a plain React text child, so decode explicitly or
                  // the entities show up literally instead of the character
                  // they represent.
                  decodeEntities(book.title?.rendered || __("(untitled)", "custom-blocks")),
                ),
              ),
            ),
          ),
      ),

    audience && el(ServerSideRender, { block: "custom/books-list", attributes }),
  );
}

registerBlockType("custom/books-list", {
  edit: BooksListEdit,
  save: () => null, // fully dynamic — see render_books_list_block() in books-list.php
});
