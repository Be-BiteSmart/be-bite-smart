import { useState, useEffect } from "@wordpress/element";
import { PanelBody, TextControl, Button, Notice } from "@wordpress/components";
import { __ } from "@wordpress/i18n";
import apiFetch from "@wordpress/api-fetch";
import { getSiteLanguages } from "../shared/languages";

const PLACEHOLDER_HELP = __(
  "Use {language} where the target language name should appear.",
  "custom-blocks",
);

function LangFields({ uiLang, copy, onChange, onTargetChange, allLanguages }) {
  const row = copy[uiLang.code] || {};

  return wp.element.createElement(
    wp.element.Fragment,
    null,
    wp.element.createElement(TextControl, {
      label: __("Dialog title", "custom-blocks"),
      value: row.title || "",
      onChange: (val) => onChange(uiLang.code, "title", val),
    }),
    wp.element.createElement(TextControl, {
      label: __("Message", "custom-blocks"),
      value: row.message || "",
      onChange: (val) => onChange(uiLang.code, "message", val),
      help: PLACEHOLDER_HELP,
    }),
    wp.element.createElement(TextControl, {
      label: __("Confirm button", "custom-blocks"),
      value: row.confirm || "",
      onChange: (val) => onChange(uiLang.code, "confirm", val),
      help: PLACEHOLDER_HELP,
    }),
    wp.element.createElement(TextControl, {
      label: __("Cancel button", "custom-blocks"),
      value: row.cancel || "",
      onChange: (val) => onChange(uiLang.code, "cancel", val),
    }),
    wp.element.createElement(
      "p",
      { style: { fontWeight: "600", margin: "16px 0 8px", fontSize: "13px" } },
      __("Target language names (in this dialog language)", "custom-blocks"),
    ),
    allLanguages.map((target) =>
      wp.element.createElement(TextControl, {
        key: `${uiLang.code}-target-${target.code}`,
        label: target.name,
        value: row.targets?.[target.code] || "",
        onChange: (val) => onTargetChange(uiLang.code, target.code, val),
      }),
    ),
  );
}

export function LangRestartDialogPanel() {
  const languages = getSiteLanguages();
  const [copy, setCopy] = useState(null);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const initial = window.bitesmartLangRestartDialog?.saved;
    if (initial) {
      setCopy(initial);
      return;
    }

    apiFetch({ path: "/bitesmart/v1/lang-restart-dialog" })
      .then(setCopy)
      .catch(() => {
        setCopy(window.bitesmartLangRestartDialog?.defaults ?? {});
      });
  }, []);

  const updateField = (code, field, value) => {
    setCopy((prev) => ({
      ...prev,
      [code]: {
        ...prev[code],
        [field]: value,
      },
    }));
    setStatus("");
  };

  const updateTarget = (uiCode, targetCode, value) => {
    setCopy((prev) => ({
      ...prev,
      [uiCode]: {
        ...prev[uiCode],
        targets: {
          ...(prev[uiCode]?.targets ?? {}),
          [targetCode]: value,
        },
      },
    }));
    setStatus("");
  };

  const resetToDefaults = () => {
    const defaults = window.bitesmartLangRestartDialog?.defaults;
    if (defaults) {
      setCopy(defaults);
      setStatus("");
    }
  };

  const save = async () => {
    if (!copy) {
      return;
    }

    setSaving(true);
    setStatus("");

    try {
      const saved = await apiFetch({
        path: "/bitesmart/v1/lang-restart-dialog",
        method: "POST",
        data: copy,
      });
      setCopy(saved);
      if (window.bitesmartLangRestartDialog) {
        window.bitesmartLangRestartDialog.saved = saved;
      }
      setStatus("saved");
    } catch {
      setStatus("error");
    }

    setSaving(false);
  };

  return wp.element.createElement(
    PanelBody,
    {
      title: __("Language switch dialog", "custom-blocks"),
      initialOpen: false,
    },
    wp.element.createElement(
      "p",
      { className: "episode-field-hint", style: { marginBottom: "12px" } },
      __(
        "Shown when visitors change language while a video is playing. Wording is site-wide for all episode cards. Dialog language matches the video language they were watching.",
        "custom-blocks",
      ),
    ),
    !copy &&
      wp.element.createElement(
        "p",
        { className: "episode-field-hint" },
        __("Loading…", "custom-blocks"),
      ),
    copy &&
      languages.map((uiLang) =>
        wp.element.createElement(
          "div",
          {
            key: uiLang.code,
            style: {
              marginBottom: "20px",
              paddingBottom: "16px",
              borderBottom: "1px solid #cdd8e0",
            },
          },
          wp.element.createElement(
            "p",
            { style: { fontWeight: "700", marginBottom: "8px" } },
            uiLang.name +
              " " +
              __("dialog", "custom-blocks") +
              ` (${uiLang.label})`,
          ),
          wp.element.createElement(LangFields, {
            uiLang,
            copy,
            onChange: updateField,
            onTargetChange: updateTarget,
            allLanguages: languages,
          }),
        ),
      ),
    status === "saved" &&
      wp.element.createElement(Notice, {
        status: "success",
        isDismissible: false,
      }, __("Dialog text saved.", "custom-blocks")),
    status === "error" &&
      wp.element.createElement(Notice, {
        status: "error",
        isDismissible: false,
      }, __("Could not save. Try again.", "custom-blocks")),
    copy &&
      wp.element.createElement(
        "div",
        { style: { display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" } },
        wp.element.createElement(
          Button,
          { variant: "primary", onClick: save, isBusy: saving, disabled: saving },
          __("Save dialog text", "custom-blocks"),
        ),
        wp.element.createElement(
          Button,
          { variant: "secondary", onClick: resetToDefaults, disabled: saving },
          __("Reset to defaults", "custom-blocks"),
        ),
      ),
  );
}
