import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sanitize from "sanitize-html";

const escape = value => String(value ?? "").replace(/[&<>"']/g, char =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const dollars = value => Number.isFinite(value) ? `$${value.toFixed(4)}` : "Unknown";
const list = values => `<ul>${(values ?? []).map(value => `<li>${escape(value)}</li>`).join("")}</ul>`;
const articleHtml = html => sanitize(html ?? "", {
  allowedTags: ["p", "br", "h2", "h3", "h4", "strong", "em", "ul", "ol", "li", "blockquote", "table", "thead", "tbody", "tr", "th", "td", "a"],
  allowedAttributes: { a: ["href", "title"] },
  allowedSchemes: ["https", "http"], allowProtocolRelative: false,
  transformTags: { a: (tagName, attrs) => ({ tagName, attribs: { ...attrs, target: "_blank", rel: "noopener noreferrer" } }) },
});

export function renderPilotReview(reports) {
  const sections = reports.map(report => {
    const cases = (report.comparison ?? []).map(row => {
      const draft = report[row.variant];
      const evidence = report[`${row.variant}-evidence`];
      const generationCost = row.estimatedGenerationCostUsd + row.estimatedPreparationCostUsd +
        (row.variant === "A-baseline" ? 0 : row.estimatedEvidenceCheckCostUsd);
      const costLabel = !draft ? "Not completed" : report.unknownCostRequests ? `${dollars(generationCost)} known portion` : dollars(generationCost);
      return `<section class="draft"><h3>${escape(row.variant === "A-baseline" ? "A · Existing writing method" :
        row.variant === "B-research" ? "B · Research-assisted writing" : "C · Cheaper outline experiment")}</h3>
        <p class="metrics">Text/search estimate: <strong>${costLabel}</strong> · ${escape(draft?.wordCount ?? "Unknown")} words
        · Writing and checking: ${Math.round((row.modelTimeMs ?? 0) / 1000)} seconds (excludes source retrieval)</p>
        ${row.variant === "A-baseline" ? `<p class="muted">Additional evaluation-only evidence check: ${dollars(row.estimatedEvidenceCheckCostUsd)}. This is excluded from the existing method's generation cost.</p>` : ""}
        <details><summary>Read the draft</summary><article><h4>${escape(draft?.title ?? report.topic)}</h4>${articleHtml(draft?.bodyHtml)}</article></details>
        <details><summary>Automated review findings (${evidence?.issues?.length ?? "not checked"})</summary>
        <p>These are unconfirmed review findings. A missing citation in the existing method is a coverage difference, not proof of a factual error.</p>
        ${list(evidence?.issues)}${evidence?.issues?.length === 0 ? "<p>No issues reported. Human review is still required.</p>" : ""}</details>
        <p class="review">Human review: <strong>Pending</strong> · Editing time: <strong>Not measured</strong></p></section>`;
    }).join("");
    return `<section class="case"><p class="eyebrow">${escape(report.caseId)}</p><h2>${escape(report.topic)}</h2>
      <p>${escape(report.brief?.brandName)} · ${escape(report.brief?.language)} · ${escape(report.brief?.country)}</p>
      ${report.failure || report.reviewFailure ? `<p class="alert">Trial incomplete: ${escape(report.failure ?? report.reviewFailure)}</p>` : ""}
      <p>Private drafts using the saved business profile and planned topic. Nothing has been published.
      Both versions receive the same evidence check. Human review is still pending.</p>
      ${report.assistantReview ? `<div class="alert"><strong>Preliminary editorial assessment</strong>
        ${list(report.assistantReview.findings)}<p>${escape(report.assistantReview.recommendation)}</p>
        <p class="muted">AI-assisted inspection; this is not the business owner's approval.</p></div>` : ""}
      <details><summary>Business facts and writing preferences used</summary>
        <p>${escape(report.brief?.description)}</p><p>${escape(report.brief?.tone)}</p>
        ${list(report.brief?.facts)}<p>${escape(report.brief?.articleInstructions)}</p></details>
      <div class="drafts">${cases}</div>
      <details><summary>Research evidence and limitations</summary>
        <h3>Warnings</h3>${list(report.research?.warnings)}
        <h3>Source excerpts</h3>${(report.sources ?? []).map(source => `<section>
          <h4>${escape(source.id)} · ${escape(source.title)}</h4>
          <p>${articleHtml(`<a href="${escape(source.url)}">${escape(source.url)}</a>`)}</p>
          <blockquote>${escape(source.excerpt)}</blockquote></section>`).join("")}
        <h3>Claims retained in the brief</h3>${(report.research?.claims ?? []).map(claim =>
          `<p><strong>${escape(claim.sourceId)}:</strong> ${escape(claim.text)}</p><blockquote>${escape(claim.quote)}</blockquote>`).join("")}
      </details><p class="muted">Calls included in this report: ${dollars(report.estimatedKnownCostUsd)} known estimate;
      ${escape(report.unknownCostRequests ?? "unknown")} requests with unknown cost. Generated ${escape(report.finishedAt ?? "not recorded")}.
      ${report.evidenceReplay ? `Evidence rechecked ${escape(report.evidenceReplay.checkedAt)}.` : ""}</p></section>`;
  }).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
    <meta name="referrer" content="no-referrer"><title>RepGet · Private content pilot</title>
    <style>
    :root{font-family:system-ui,sans-serif;color:#17283a;background:#eef2f6;line-height:1.6}
    body{max-width:1160px;margin:auto;padding:32px 20px}h1{font-size:2.2rem;line-height:1.2}
    h2{font-size:1.6rem}h3{font-size:1.15rem}h4{font-size:1.05rem}a{color:#1756b5;overflow-wrap:anywhere}
    .eyebrow{text-transform:uppercase;font-size:.8rem;letter-spacing:.08em;color:#516474}
    .case,.intro{padding:28px;background:white;border:1px solid #ccd5df;border-radius:14px;margin:24px 0}
    .drafts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;margin:24px 0}
    .draft{min-width:0;background:#f8fafc;border:1px solid #ccd5df;border-radius:10px;padding:20px}
    .muted,.metrics{font-size:.9rem;color:#435568}summary{cursor:pointer;font-weight:650;padding:12px 0}
    details{border-top:1px solid #d6dfe7;overflow-wrap:anywhere}article{font-family:Georgia,serif;line-height:1.8}
    article h2{font-size:1.35rem}article h3{font-size:1.15rem}table{border-collapse:collapse;width:100%;font-size:.9rem}
    th,td{padding:8px;border:1px solid #ccd5df;text-align:left;overflow-wrap:anywhere}
    blockquote{margin:16px 0;border-left:3px solid #88a4c4;padding-left:16px;white-space:pre-wrap}
    .review{padding-top:14px;border-top:1px solid #ccd5df}.alert{background:#fff1d6;padding:14px}
    @media(max-width:800px){.drafts{grid-template-columns:1fr}.case,.intro{padding:18px}body{padding:16px 10px}}
    @media print{body{background:white;max-width:none}.drafts{display:block}.case,.draft{break-inside:avoid}}
    </style></head><body><p class="eyebrow">RepGet / Private evaluation</p><h1>Real business content pilot</h1>
    <div class="intro"><p><strong>Review drafts only. Nothing in this file is approved or published.</strong></p>
    <p>Compare each pair for factual accuracy, business relevance, usefulness and corrections needed.
    Read each draft before opening the automated findings. Check important claims against the displayed sources
    and the business facts. Record actual editing minutes separately; they cannot be inferred from AI call time.</p>
    <p>Text/search costs are estimates. Images, links added later in the pipeline, hosting, retries and human editing
    are excluded. One business and two topics cannot establish performance for all customers.</p>
    <p>Decision required after human review: keep current defaults, revise the research approach, or enable a small
    website-specific pilot with mandatory draft approval.</p></div>${sections}</body></html>`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const root = realpathSync(path.resolve("test-results/content-pilot"));
  const files = process.argv.slice(2);
  if (!files.length || files.length > 3) throw new Error("Pass one to three customer report JSON filenames.");
  const reports = files.map(filename => {
    const fullPath = realpathSync(path.resolve(root, filename));
    const relative = path.relative(root, fullPath);
    if (relative.startsWith("..") || path.isAbsolute(relative) || !/^customer-[a-z0-9-]+\.json$/.test(relative)) {
      throw new Error("Use customer report JSON files directly inside test-results/content-pilot.");
    }
    return JSON.parse(readFileSync(fullPath, "utf8"));
  });
  const output = path.join(root, "customer-review.html");
  writeFileSync(output, renderPilotReview(reports), { mode: 0o600 });
  console.log(JSON.stringify({ review: output, reports: reports.length, published: false }));
}
