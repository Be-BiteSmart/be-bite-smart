/** Default site languages — mirrored in site-lang.php; editor may override via bitesmartLanguages. */
export const DEFAULT_SITE_LANGUAGES = [
  {
    code: "en",
    label: "EN",
    name: "English",
    analytics: "english",
  },
  {
    code: "es",
    label: "ES",
    name: "Spanish",
    analytics: "spanish",
  },
  {
    code: "hi",
    label: "HI",
    name: "Hindi",
    analytics: "hindi",
  },
];

export function getSiteLanguages() {
  if (
    typeof window !== "undefined" &&
    window.bitesmartLanguages?.languages?.length
  ) {
    return window.bitesmartLanguages.languages;
  }
  return DEFAULT_SITE_LANGUAGES;
}

export function getVimeoId(url) {
  if (!url) return null;
  const match = String(url).match(/vimeo\.com\/(\d+)/);
  return match ? match[1] : null;
}

/** Merge videosByLang with legacy vimeoUrlEn / vimeoUrlEs attributes. */
export function videosFromAttributes(attributes) {
  const videos = { ...(attributes.videosByLang || {}) };

  if (attributes.vimeoUrlEn && !videos.en) {
    videos.en = attributes.vimeoUrlEn;
  }
  if (attributes.vimeoUrlEs && !videos.es) {
    videos.es = attributes.vimeoUrlEs;
  }

  return videos;
}

/** Lang code => Vimeo numeric ID (drops empty URLs). */
export function vimeoIdsByLang(urlsByLang) {
  const out = {};
  Object.entries(urlsByLang || {}).forEach(([code, url]) => {
    const id = getVimeoId(url);
    if (id) {
      out[code] = id;
    }
  });
  return out;
}

/** Language codes that have a Vimeo URL, in site language order. */
export function availableLanguageCodes(urlsByLang, languages = getSiteLanguages()) {
  return languages
    .map((lang) => lang.code)
    .filter((code) => getVimeoId(urlsByLang?.[code]));
}

export function normalizeLangCode(code) {
  if (!code) return "en";
  const primary = String(code).toLowerCase().replace(/_/g, "-").split("-")[0];
  const known = getSiteLanguages().some((lang) => lang.code === primary);
  return known ? primary : "en";
}

export function analyticsNameForCode(code, languages = getSiteLanguages()) {
  const normalized = normalizeLangCode(code);
  const match = languages.find((lang) => lang.code === normalized);
  return match?.analytics ?? normalized;
}

/** TranslatePress sets html lang and body classes like translatepress-es_ES. */
export function detectSiteLangFromDocument(languages = getSiteLanguages()) {
  const htmlLang = (document.documentElement.lang || "").toLowerCase();
  if (htmlLang) {
    const fromHtml = normalizeLangCode(htmlLang);
    if (languages.some((l) => l.code === fromHtml)) {
      return fromHtml;
    }
  }

  const bodyClass = document.body.className.toLowerCase();
  for (const lang of languages) {
    if (lang.code === "en") {
      continue;
    }
    const prefix = `translatepress-${lang.code}`;
    if (
      bodyClass.includes(prefix) ||
      new RegExp(`\\btranslatepress-${lang.code}[_-]`).test(bodyClass)
    ) {
      return lang.code;
    }
  }

  return "en";
}

export function parseJsonDataset(raw, fallback = {}) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/** Legacy data-vimeo-en / data-vimeo-es on a block element. */
export function legacyVimeoIdsFromDataset(dataset) {
  const out = {};
  if (dataset.vimeoEn) out.en = dataset.vimeoEn;
  if (dataset.vimeoEs) out.es = dataset.vimeoEs;
  return out;
}

export function resolveVideosForBlock(block) {
  const fromJson = parseJsonDataset(block.dataset.videos, null);
  if (fromJson && Object.keys(fromJson).length) {
    return fromJson;
  }
  return legacyVimeoIdsFromDataset(block.dataset);
}

/** Guarantee defaultCode (e.g. "en") is always present in a language-code list. */
export function ensureDefaultLanguage(codes, defaultCode = "en") {
  return codes.includes(defaultCode) ? codes : [defaultCode, ...codes];
}

/** Replace {language} in a translated template string with a language name. */
export function applyLanguagePlaceholder(template, languageName) {
  return String(template ?? "").replace(/\{language\}/gi, languageName);
}
