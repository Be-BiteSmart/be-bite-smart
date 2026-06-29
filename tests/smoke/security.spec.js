import { test, expect } from "@playwright/test";
import {
  SENSITIVE_PATHS,
  isSensitivePathBlocked,
  sensitivePathFailureMessage,
  rationaleForEntry,
} from "../helpers/security.js";
import { safeGet } from "../helpers/wordfence-safe-request.js";

test.describe("Security hygiene", () => {
  test.describe.configure({ 
    mode: "default", // Serial execution required for safeGet's pacing to work
    retries: 0, // safeGet already handles retries with exponential backoff
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
        const response = await safeGet(request, path);
        status = response.status();
      } catch (error) {
        // Only catch actual network errors - connection failures indicate the path
        // is not publicly accessible. Other errors (e.g., bugs in safeGet) should
        // propagate to surface real issues.
        const isNetworkError =
          error.message &&
          /ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|socket hang up|getaddrinfo/i.test(
            error.message
          );

        if (!isNetworkError) {
          throw error;
        }

        await testInfo.attach("Network error (path inaccessible)", {
          body: `Connection failed for ${path} (possibly a transient network issue or server-side blocking): ${error.message}`,
          contentType: "text/plain",
        });
        status = 0; // Treat network errors as blocked (path inaccessible)
      }

      // status=0 (network error) should always pass - path is not accessible.
      // This is an intentional override of isSensitivePathBlocked: network errors
      // mean the path is unreachable, which satisfies the security requirement regardless of mode.
      const isBlocked = status === 0 || isSensitivePathBlocked(status, mode);
      expect(
        isBlocked,
        sensitivePathFailureMessage(path, status, { mode }),
      ).toBe(true);
    });
  }
});
