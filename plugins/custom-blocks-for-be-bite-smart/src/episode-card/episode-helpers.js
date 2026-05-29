import {
  availableLanguageCodes,
  getSiteLanguages,
  getVimeoId,
  videosFromAttributes,
  vimeoIdsByLang,
  watchLabelsMap,
} from "../shared/languages";

export function migrateEpisodeAttributes(attributes) {
  const videosByLang = videosFromAttributes(attributes);
  return {
    ...attributes,
    videosByLang,
  };
}

export function renderLanguagePicker(wp, urlsByLang, { activeCode = "en" } = {}) {
  const codes = availableLanguageCodes(urlsByLang);
  if (codes.length <= 1) {
    return null;
  }

  const languages = getSiteLanguages();
  const activeIndex = Math.max(0, codes.indexOf(activeCode));

  return wp.element.createElement(
    "div",
    {
      className: "episode-lang-picker",
      "data-translate": "no",
      style: {
        "--lang-count": String(codes.length),
        "--lang-index": String(activeIndex),
      },
    },
    wp.element.createElement("div", { className: "lang-segment-slider" }),
    wp.element.createElement(
      "div",
      { className: "lang-segments" },
      codes.map((code) => {
        const meta = languages.find((lang) => lang.code === code);
        return wp.element.createElement(
          "button",
          {
            key: code,
            type: "button",
            className:
              "lang-segment" + (code === activeCode ? " active" : ""),
            "data-lang": code,
          },
          meta?.label ?? code.toUpperCase(),
        );
      }),
    ),
  );
}

export function episodeArticleDataAttributes(attributes) {
  const urlsByLang = videosFromAttributes(attributes);
  const videoIds = vimeoIdsByLang(urlsByLang);
  const labels = watchLabelsMap();

  return {
    "data-videos": JSON.stringify(videoIds),
    "data-watch-labels": JSON.stringify(labels),
  };
}

export { getVimeoId, videosFromAttributes };
