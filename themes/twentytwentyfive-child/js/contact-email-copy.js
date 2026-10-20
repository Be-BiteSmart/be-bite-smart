(() => {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function encodedEmailFrom(link) {
    const encoded = link.getAttribute("data-enc-email");
    if (!encoded) return "";

    return encoded
      .replace(/\[at\]/g, "@")
      .replace(/[a-z]/gi, (character) => {
        const code = character.charCodeAt(0);
        const base = code <= 90 ? 65 : 97;
        return String.fromCharCode(base + ((code - base + 13) % 26));
      });
  }

  function emailFor(button) {
    const link = button.previousElementSibling;
    if (!link || !link.matches(".contact-page-contact-link")) return "";

    const visibleEmail = link.innerText.trim();
    if (emailPattern.test(visibleEmail)) return visibleEmail;

    const decodedEmail = encodedEmailFrom(link);
    return emailPattern.test(decodedEmail) ? decodedEmail : "";
  }

  function fallbackCopy(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }
    textarea.remove();
    return copied;
  }

  function showCopyResult(button, copied) {
    const message = copied ? "Copied!" : "Unable to copy";
    button.textContent = message;
    button.setAttribute(
      "aria-label",
      copied ? "Email address copied" : "Unable to copy email address",
    );

    const status = button.nextElementSibling;
    if (status && status.matches(".contact-page-copy-status")) {
      status.textContent = copied
        ? "Email address copied to clipboard."
        : "Unable to copy email address.";
    }

    window.setTimeout(() => {
      button.textContent = "Copy email";
      button.setAttribute("aria-label", "Copy email address");
      if (status && status.matches(".contact-page-copy-status")) {
        status.textContent = "";
      }
    }, 2000);
  }

  async function copyEmail(button) {
    const email = emailFor(button);
    if (!email) {
      showCopyResult(button, false);
      return;
    }

    let copied = false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(email);
        copied = true;
      } catch {
        copied = fallbackCopy(email);
      }
    } else {
      copied = fallbackCopy(email);
    }

    showCopyResult(button, copied);
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest(".contact-page-copy-email");
    if (button) copyEmail(button);
  });
})();
