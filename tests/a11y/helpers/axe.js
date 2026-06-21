import { expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * WCAG 2.0/2.1 A & AA plus axe best-practice rules (extra nitpicks beyond WCAG).
 * @see https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md
 */
export const AXE_RULE_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "best-practice",
];

/** Third-party embed subtrees excluded from scan (not fixable in our theme). */
export const AXE_IFRAME_EXCLUDE =
  'iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="player.vimeo"]';

const BLOCKING_IMPACTS = new Set(["critical", "serious", "moderate"]);
const FAIL_THRESHOLD_LABEL = "critical, serious, or moderate";

/**
 * Run axe with documented scope. Returns full axe results object.
 */
export async function runA11yScan(page) {
  return new AxeBuilder({ page })
    .withTags(AXE_RULE_TAGS)
    .exclude(AXE_IFRAME_EXCLUDE)
    .analyze();
}

/**
 * Human-readable + JSON summary of what axe evaluated on the page.
 */
export function buildA11yScanReport(results, { label, path, url }) {
  const blocking = results.violations.filter((v) =>
    BLOCKING_IMPACTS.has(v.impact),
  );
  const minorViolations = results.violations.filter((v) => v.impact === "minor");

  const passedRules = results.passes.map((p) => ({
    id: p.id,
    help: p.help,
    impact: p.impact,
  }));

  const incompleteRules = results.incomplete.map((r) => ({
    id: r.id,
    help: r.help,
    impact: r.impact,
    nodes: r.nodes.slice(0, 5).map((n) => ({
      target: n.target.join(" "),
      summary: n.failureSummary,
    })),
  }));

  const json = {
    page: { label, path, url },
    scope: {
      ruleTags: AXE_RULE_TAGS,
      description:
        "WCAG 2.0/2.1 Level A & AA plus axe best-practice rules (automated only)",
      failThreshold: ["critical", "serious", "moderate"],
      nonBlockingImpacts: ["minor"],
      excludedSelectors: [AXE_IFRAME_EXCLUDE],
    },
    counts: {
      rulesPassed: results.passes.length,
      rulesInapplicable: results.inapplicable.length,
      incomplete: results.incomplete.length,
      violationsTotal: results.violations.length,
      violationsBlocking: blocking.length,
      violationsMinor: minorViolations.length,
    },
    passedRules,
    incompleteRules,
    blockingViolations: blocking.map(simplifyViolation),
    minorViolations: minorViolations.map(simplifyViolation),
  };

  const lines = [
    `A11y scan: ${label} (${path})`,
    `URL: ${url}`,
    "",
    "Scope",
    "-----",
    `- Rule tags: ${AXE_RULE_TAGS.join(", ")}`,
    "- Standard: WCAG 2.0/2.1 A & AA + best-practice (automated rules only)",
    "- Test fails on: critical, serious, or moderate violations",
    "- Minor violations: included in this report but do not fail the test",
    `- Excluded from scan: ${AXE_IFRAME_EXCLUDE}`,
    "",
    "Summary",
    "-------",
    `- Rules passed: ${results.passes.length}`,
    `- Rules not applicable on this page: ${results.inapplicable.length}`,
    `- Incomplete (axe could not fully determine — manual review): ${results.incomplete.length}`,
    `- Violations (all severities): ${results.violations.length}`,
    `- Blocking violations: ${blocking.length}`,
    `- Minor violations (non-blocking): ${minorViolations.length}`,
    "",
    "Passed checks (rule id — what was verified)",
    "-------------------------------------------",
    ...passedRules.map((r) => `- ${r.id}: ${r.help}`),
  ];

  if (incompleteRules.length) {
    lines.push(
      "",
      "Incomplete (manual follow-up recommended)",
      "----------------------------------------",
    );
    for (const r of incompleteRules) {
      lines.push(`- ${r.id}: ${r.help}`);
      for (const n of r.nodes) {
        lines.push(`    ${n.target}`);
      }
    }
  }

  lines.push(
    "",
    "Minor violations (non-blocking — test still passes)",
    "-----------------------------------------------------",
  );
  if (minorViolations.length === 0) {
    lines.push("- None");
  } else {
    for (const v of minorViolations) {
      lines.push(formatViolation(v));
    }
  }

  if (blocking.length) {
    lines.push("", "Blocking violations", "-------------------");
    for (const v of blocking) {
      lines.push(formatViolation(v));
    }
  }

  return { text: lines.join("\n"), json };
}

/**
 * Run axe, fail on critical/serious/moderate violations, return scan report for attachments.
 */
export async function expectNoBlockingA11yViolations(page, contextLabel, meta) {
  const results = await runA11yScan(page);

  const blocking = results.violations.filter((v) =>
    BLOCKING_IMPACTS.has(v.impact),
  );

  const summary = blocking.map(formatViolation).join("\n\n");

  expect(
    blocking,
    blocking.length
      ? `${contextLabel}: ${blocking.length} ${FAIL_THRESHOLD_LABEL} a11y violation(s):\n\n${summary}`
      : `${contextLabel}: no ${FAIL_THRESHOLD_LABEL} a11y violations`,
  ).toEqual([]);

  return buildA11yScanReport(results, meta);
}

function simplifyViolation(violation) {
  return {
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    helpUrl: violation.helpUrl,
    nodes: violation.nodes.slice(0, 5).map((n) => ({
      target: n.target.join(" "),
      summary: n.failureSummary,
    })),
  };
}

function formatViolation(violation) {
  const nodes = violation.nodes
    .slice(0, 5)
    .map((node) => `  - ${node.target.join(" ")}: ${node.failureSummary}`)
    .join("\n");
  const more =
    violation.nodes.length > 5
      ? `\n  … and ${violation.nodes.length - 5} more node(s)`
      : "";

  return `[${violation.impact}] ${violation.id}: ${violation.help}\n${violation.helpUrl}\n${nodes}${more}`;
}
