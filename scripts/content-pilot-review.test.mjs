import { test } from "node:test";
import assert from "node:assert/strict";
import { renderPilotReview } from "./content-pilot-review.mjs";

test("private review cannot execute model/source HTML or load tracking images", () => {
  const output = renderPilotReview([{
    topic: '<img src="https://tracking.invalid/metadata" onerror="alert(1)">',
    comparison: [{ variant: "B-research", estimatedGenerationCostUsd: 0.05,
      estimatedPreparationCostUsd: 0.02, estimatedEvidenceCheckCostUsd: 0.03 }],
    "B-research": { bodyHtml: '<script>alert(1)</script><img src="https://tracking.invalid/body"><p onclick="evil()">Draft <a href="javascript:evil()">link</a></p>' },
    sources: [{ title: "<script>evil()</script>", url: "javascript:evil()", excerpt: "<iframe src='https://tracking.invalid'></iframe>" }],
  }]);
  assert.ok(!/<script|<img|<iframe|onclick=|href="javascript:/i.test(output));
  assert.ok(output.includes("default-src 'none'"));
  assert.ok(output.includes("Human review: <strong>Pending</strong>"));
  assert.ok(output.includes("$0.1000"));
});

test("baseline generation cost excludes its evaluation-only evidence check", () => {
  const output = renderPilotReview([{
    comparison: [{ variant: "A-baseline", estimatedGenerationCostUsd: 0.05,
      estimatedPreparationCostUsd: 0, estimatedEvidenceCheckCostUsd: 0.03 }],
    "A-baseline": { bodyHtml: "<p>Draft</p>" },
  }]);
  assert.ok(output.includes("Text/search estimate: <strong>$0.0500</strong>"));
  assert.ok(output.includes("evaluation-only evidence check: $0.0300"));
});
