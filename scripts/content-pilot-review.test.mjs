import { test } from "node:test";
import assert from "node:assert/strict";
import { renderPilotReview } from "./content-pilot-review.mjs";

test("private review cannot execute model/source HTML or load tracking images", () => {
  const output = renderPilotReview([{
    topic: '<img src="https://tracking.invalid/metadata" onerror="alert(1)">',
    comparison: [{ variant: "B-research", estimatedGenerationCostUsd: 0.05,
      estimatedPreparationCostUsd: 0.02, estimatedEvidenceCheckCostUsd: 0.03 }],
    "B-research": { bodyHtml: '<script>alert(1)</script><img src="https://tracking.invalid/body"><p onclick="evil()">Draft <a href="javascript:evil()">link</a></p>' },
    editorialDraft: { bodyHtml: '<script>evil()</script><img src="https://tracking.invalid/edit"><p>Corrected</p>',
      changes: ["<script>evil()</script>"], evidence: { checked: true, issues: [] }, extraReviewCostUsd: 0.01 },
    sources: [{ title: "<script>evil()</script>", url: "javascript:evil()", excerpt: "<iframe src='https://tracking.invalid'></iframe>" }],
  }]);
  assert.ok(!/<script|<img|<iframe|onclick=|href="javascript:/i.test(output));
  assert.ok(output.includes("default-src 'none'"));
  assert.ok(output.includes("Human review: <strong>Pending</strong>"));
  assert.ok(output.includes("$0.1000"));
  assert.ok(output.includes("not an untouched model output"));
  assert.ok(output.includes("Additional evaluation-only check: $0.0100"));
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

test("revision report retains preparation cost and escapes custom comparison labels", () => {
  const output = renderPilotReview([{
    revision: { writing: "article-body-v2" }, revisionCostUsd: 0.12,
    comparison: [{ variant: "D-revised", label: 'After <script>evil()</script>',
      estimatedGenerationCostUsd: 0.05, estimatedPreparationCostUsd: 0.02,
      estimatedEvidenceCheckCostUsd: 0.03 }],
    "D-revised": { bodyHtml: "<p>Draft</p>" },
  }]);
  assert.ok(output.includes("Text/search estimate: <strong>$0.1000</strong>"));
  assert.ok(output.includes("Additional calls for this revision: $0.1200"));
  assert.ok(output.includes("After &lt;script&gt;evil()&lt;/script&gt;"));
  assert.ok(!output.includes("<script>"));
});
