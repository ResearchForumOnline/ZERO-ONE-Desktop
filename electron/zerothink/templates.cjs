// Copyright 2026 Shafaet Brady Hussain. SPDX-License-Identifier: Apache-2.0
"use strict";
const TEMPLATES = Object.freeze([
  { id: "literature-review", name: "Literature review", purpose: "Compare supplied literature and make evidence gaps visible.", stages: ["Define scope", "Screen sources", "Map agreements and disagreements", "Draft synthesis", "Review claims"], checks: ["Separate full-text evidence from snippets", "Identify source versions and limitations", "Do not invent references"] },
  { id: "evidence-map", name: "Evidence map", purpose: "Group relevant excerpts and identify unanswered questions.", stages: ["Define question", "Retrieve excerpts", "Group signals", "List missing evidence"], checks: ["Keep source IDs on excerpts", "An excerpt is not independent verification"] },
  { id: "expert-discovery", name: "Expert discovery", purpose: "Use supplied public evidence to identify relevant expertise.", stages: ["Define expertise", "Read public source evidence", "Compare candidate fit", "List verification steps"], checks: ["No invented biographies", "No contact or outreach without user action"] },
  { id: "collaboration-plan", name: "Collaboration plan", purpose: "Build an evidence-backed shortlist and a draft collaboration plan.", stages: ["Define objectives", "Compare supplied candidate evidence", "Describe roles", "Draft plan"], checks: ["Verify affiliations", "Distinguish a suggestion from agreement"] },
  { id: "study-plan", name: "Study plan", purpose: "Build a learning or supervision plan from supplied constraints and materials.", stages: ["Define constraints", "Identify prerequisites", "Sequence work", "Define review checkpoints"], checks: ["Explain assumptions", "Make next actions concrete"] },
  { id: "gap-analysis", name: "Gap analysis", purpose: "Find unsupported claims and missing comparisons in supplied research.", stages: ["Map question", "Retrieve evidence", "Compare claims", "Prioritize missing tests"], checks: ["Each gap must relate to an actual question", "Absence in this corpus is not proof of absence everywhere"] },
  { id: "claim-ledger", name: "Claim ledger", purpose: "Separate source-backed excerpts, interpretation and unverified claims.", stages: ["Extract claim candidates", "Link sources", "Record uncertainty", "Plan validation"], checks: ["Retain source IDs", "Do not convert model agreement into proof"] },
  { id: "paper-draft", name: "Research paper draft", purpose: "Draft a paper from supplied evidence with a visible critique and revision pass.", stages: ["Refine question", "Map evidence", "Draft sections", "Critique methods and claims", "Revise for researcher review"], checks: ["No fabricated results or citations", "Describe model-assisted drafting accurately", "Researcher reviews before publication"] },
  { id: "custom", name: "Custom research process", purpose: "Use the user's supplied question and evidence as a bounded research workflow.", stages: ["Define purpose", "Select evidence", "Draft", "Review", "Export"], checks: ["Make assumptions explicit", "Preserve uncertainty and provenance"] }
].map((entry) => Object.freeze({ ...entry, stages: Object.freeze(entry.stages), checks: Object.freeze(entry.checks) })));
function getTemplate(id = "evidence-map") {
  const entry = TEMPLATES.find((item) => item.id === id);
  if (!entry) throw new TypeError("Choose one of the documented research template IDs.");
  return entry;
}
module.exports = { TEMPLATES, getTemplate };
