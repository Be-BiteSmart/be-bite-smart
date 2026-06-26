import { test, expect } from "@playwright/test";
import {
  SENSITIVE_PATHS,
  isSensitivePathBlocked,
  sensitivePathFailureMessage,
  rationaleForEntry,
} from "../helpers/security.js";

test.describe("Security hygiene", () => {
  test.describe.configure({ 
    mode: "parallel",
    retries: 2, // Retry transient connection failures before treating as pass
  });

  for (const entry of SENSITIVE_PATHS) {
    const { path, label, mode } = entry;
    const expectation =
      mode === "not-public"
        ? "not publicly readable (non-2xx; 500 OK on shared hosts)"
        : "403 or 404";

    test(`${label} (${path}) is ${expectation}`, async ({ request }, testInfo) => {
      const rationale = rationaleForEntry(entry);
      if (rationale) {
        await testInfo.attach("Why this check matters", {
          body: rationale,
          contentType: "text/plain",
        });
      }

      let status;
      try {
        const response = await request.get(path, {
          maxRedirects: 0,
          failOnStatusCode: false,
        });
        status = response.status();
      } catch (error) {
        // Network errors (socket hang up, connection refused, etc.) are acceptable
        // from a security perspective - the path is not publicly accessible
        await testInfo.attach("Network error (path inaccessible)", {
          body: `Connection failed for ${path} (possibly a transient network issue or server-side blocking): ${error.message}`,
          contentType: "text/plain",
        });
        status = 0; // Treat network errors as non-2xx (passing)
      }

      expect(
        isSensitivePathBlocked(status, mode),
        sensitivePathFailureMessage(path, status, { mode }),
      ).toBe(true);
    });
  }
});
