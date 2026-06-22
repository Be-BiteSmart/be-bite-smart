import { test, expect } from "@playwright/test";
import {
  SENSITIVE_PATHS,
  isSensitivePathBlocked,
  sensitivePathFailureMessage,
  rationaleForEntry,
} from "../helpers/security.js";

test.describe("Security hygiene", () => {
  test.describe.configure({ mode: "parallel" });

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

      const response = await request.get(path, {
        maxRedirects: 0,
        failOnStatusCode: false,
      });

      const status = response.status();

      expect(
        isSensitivePathBlocked(status, mode),
        sensitivePathFailureMessage(path, status, { mode }),
      ).toBe(true);
    });
  }
});
