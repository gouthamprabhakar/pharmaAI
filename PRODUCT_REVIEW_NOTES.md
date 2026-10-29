# PharmaAI product review notes

These notes capture decisions and usability issues found during the screen-by-screen walkthrough. They are not implemented changes yet.

## Discovery required before implementation

- The Returns workflow is a working hypothesis, not a validated pharmaceutical-industry process.
- Interview manufacturer returns operations, finance or credit-note teams, distributor or stockist users, and—only if relevant—warehouse operations before redesigning or building the backend.
- Validate the real source documents, ownership handoffs, return-policy rules, review burden, ERP touchpoints, credit-note process, exception types, and current measurable pain.
- Treat the distributor portal, standardized templates, finance worklist, AI assistance, and warehouse reconciliation as assumptions until industry interviews confirm them.
- Do not position predictive expiry or other proposed AI features as core requirements without evidence that customers need and would act on them.
- Sales Recon discovery questions:
  - Do manufacturers currently receive secondary-sales and closing-stock reports from every distributor or stockist?
  - Who provides them, how frequently, in which formats, and how late or incomplete are they?
  - Are product, batch, unit-of-measure, returns, transfers, write-offs, and adjustment fields consistently available?
  - Are distributors contractually required and operationally willing to use a standardized template?
  - Who reconciles these reports today, what decisions result, and what measurable loss or delay does the current process create?
  - If reliable secondary-sales and closing-stock data is unavailable, should Sales Recon be removed from the initial product scope?

## Overall direction

- The current 35 references should not become 35 separate destinations. Many are steps, states, or detail views inside a smaller number of core workflows.
- Routine work should be much shorter than first-time setup. Saved distributor formats and rules should remove repeated mapping steps.
- The prototype should demonstrate navigation and state changes even when all data is fictional. Buttons should not stop at a simulation message when a safe next screen exists.
- PharmaAI should adapt to existing manufacturer files and terminology. It should not require a company to overhaul its ERP or operating process.
- AI should help only with ambiguity, such as first-time column suggestions or unusual aliases. Deterministic rules should handle repeat mappings, calculations, and validation.
- Human users must approve consequential return, credit, and adjustment decisions.

## AI product role

- The current prototype has no connected AI service. Do not describe its fictional confidence labels or hardcoded statuses as working AI.
- Product decision required: either implement a clearly AI-native capability or reconsider the PharmaAI positioning. The standardized Returns workflow alone is primarily rules and workflow automation.
- Keep validation, monetary calculations, case status, permissions, and policy enforcement deterministic and auditable.
- Use AI for ambiguity-heavy work:
  - Extract fields from invoices, return approvals, credit notes, and other PDFs or scans.
  - Match distributor, product, batch, invoice, and return references when names or identifiers are incomplete or inconsistent.
  - Explain a discrepancy by citing the exact source records and policy clauses involved.
  - Summarize a case for a reviewer and suggest the next investigation step.
  - Prioritize exceptions using evidence quality, financial exposure, age, and repeated patterns.
- When return, sales-invoice, and issued-credit inputs are standardized, do not force AI into basic ingestion. Use deterministic validation and exact matching for those three processes.
- Near-term AI differentiator after ingestion:
  - Generate an evidence-linked case summary explaining which fields matched, which rules applied, and why human attention is required.
  - Detect unusual patterns across distributors, products, batches, return rates, repeated partial credits, and recurring exceptions.
  - Rank the Review Queue by likely financial exposure and investigation value.
  - Answer natural-language questions across the reconciled dataset while citing the underlying records.
- Longer-term AI opportunity: predict near-expiry inventory and return risk, then suggest stock redistribution or action before products expire.
- Strong candidate for the primary AI wedge: use sales velocity, batch expiry, distributor stock, and historical return patterns to predict which batches are likely to expire or be returned, estimate financial exposure, and recommend stock redistribution before the loss occurs.
- Every AI suggestion must display its supporting evidence and confidence, and remain subject to human confirmation.
- Add a visible AI assistance panel to case detail instead of presenting AI as an invisible claim in the product name.

## Overview

- Show the signed-in manufacturer as fixed workspace context, not an organization dropdown for ordinary users.
- Operational Unit should offer `All permitted operational units` when the user's access allows it.
- Distributor or Stockist should offer `All distributors` within the selected operational scope.

## Import workflow

- Add a restricted distributor portal: when a manufacturer adds a distributor, an authorized distributor user receives an invitation link and can upload only that distributor's return requests in the required template. Distributor users must not see the manufacturer's internal workspace, other partners, approval decisions, or finance data beyond their permitted case status.
- Add two intake choices: upload an existing distributor file, or download a standard return-request template.
- Make the standard versioned return template the required format for routine claims. Reject nonconforming files with clear correction guidance.
- Allow a limited one-time legacy-format mapping during distributor onboarding or a defined transition period, not unrestricted formats forever.
- The distributor template should contain only information the distributor can provide: product, batch, expiry, quantity, invoice, and return reason.
- Do not put manufacturer approval, goods receipt, or credit-note fields in the distributor intake template.
- PharmaAI should create an internal case ID when the distributor has no usable return reference.
- Save confirmed column mappings for each distributor and file format.
- Keep one canonical PharmaAI data schema. Different users must not create competing internal field definitions.
- Move first-time column mapping into administrator configuration. Ordinary importers should not map columns on every upload.
- When a saved format still matches, skip the mapping screen.
- Treat processing as an automatic progress state instead of a separate destination.
- Preferred routine flow: Upload file → Review validation issues → Confirm import.
- `Confirm valid rows` should show a completion summary, identify excluded rows, and navigate to the imported result or Returns Reconciliation.

## Return reconciliation

- Consider renaming the work area to `Returns and Credits` or `Returns and Credit Reconciliation` so users understand that manufacturer credit notes complete the return lifecycle.
- Do not require a separate manual credit-note import when an ERP or finance integration is available. Sync issued credit notes automatically and match them to approved cases.
- For an initial version without integration, let finance record the credit-note number and amount on the approved case, with optional bulk upload for many notes. Avoid forcing users through a separate screen for every case.
- On the Credit Notes view, offer two clear actions: `Record credit note` for one approved case and `Import credit notes` using a standardized bulk template. Validate and match both through the same rules.
- Add an `Awaiting credit issuance` finance worklist populated only by approved return cases. Show case ID, distributor, approved amount, expected credit, approval date, and due date.
- Let finance export selected approved cases as a standardized credit-instruction file for its ERP, then record, import, or sync the issued credit notes back into PharmaAI.
- Distinguish the internal `PharmaAI Case ID` from the `Distributor Return Reference`.
- Display the evidence trail in chronological order:
  1. Original sales invoice
  2. Distributor return request
  3. Manufacturer approval
  4. Goods receipt
  5. Credit note
- Phase 2 consideration: add warehouse goods-receipt data and compare distributor-claimed quantity with physically received quantity. Keep this outside the first simplified workflow.
- Replace the ambiguous `Amount / quantity` column with separate `Quantity` and `Amount` columns.
- Add `Eligibility` with values such as Eligible, Ineligible, and Needs Review.
- Add `Eligibility reason` showing the matched evidence, applied policy rule, and policy version.
- After the evidence trail, show an explicit reviewer decision area: confirm the partial credit and close, request a correction, or record an outstanding credit and assign follow-up to finance.
- Require a reason, owner, due date, and audit event for any unresolved or manually resolved exception.
- Use the original sales invoice or primary-sales data to prove what was sold. A purchase order alone is insufficient.
- Derive case status from matched evidence, not from the distributor return file alone:
  - Newly imported claim: Awaiting eligibility review
  - Human-approved return: Awaiting credit
  - Issued credit below expected credit: Partially credited
  - Expected and issued credit match with required evidence: Confirmed
- Reserve `Needs Review` for an exception or mismatch. Do not use it as the normal starting status for every new claim.

## Proposed product simplification

Keep a small set of primary work areas:

1. Overview
2. Import Centre
3. Returns Reconciliation
4. Sales and Inventory Reconciliation
5. Review Queue
6. Reports
7. Administration and Settings

Processing, mapping, validation, document review, case detail, and error states should appear inside these work areas as steps, drawers, panels, or detail pages rather than competing primary destinations.

- Returns Runs and Sales Runs are technical batch-history views, not chronological next steps after a case is completed. Move them under Audit History or an administrator-only area, or hide them from ordinary users.
- The unified Review Queue must route items by category to a responsible team as well as an individual owner: Finance for credit issues, Inventory or Supply Chain for stock variances, Returns Operations for approval issues, and Data Operations or administrators for import problems.
- Queue visibility and saved views must respect role, team, operational-unit, and distributor scope. The current prototype shows individual names only and has no working team routing.

## Competitor and market discovery

- Assume large pharmaceutical manufacturers already use several systems: an ERP for invoices, inventory, and credit documents; distributor-management software for secondary sales and stock; and sometimes specialist revenue-management or returns products.
- India-focused adjacent competitors include C-Square, whose PharmAssist product covers distributor inventory, batch and expiry handling, supplier returns, debit and credit notes, and reporting, and Bizom, whose Connect product collects secondary sales and inventory from distributor accounting and ERP systems.
- Enterprise incumbents such as SAP already support return workflows, inspections, authorizations, credit memos, inventory, and audit documents. PharmaAI should integrate with these systems rather than position itself as a replacement ERP.
- Specialist life-sciences revenue platforms such as Vistex and Model N cover pricing, claims, rebates, chargebacks, and revenue leakage. They are adjacent rather than exact matches for the current India distributor-return concept, but they demonstrate that large manufacturers buy specialist reconciliation layers on top of ERP.
- The product's possible wedge is an evidence-linked work layer spanning distributor files, sales invoices, policies, approval, and issued credits. This is only valuable if manufacturers currently bridge these systems with spreadsheets, email, or manual review.
- Do not claim an established market gap or unique AI advantage until manufacturer interviews confirm the current workflow, systems used, data accessibility, manual effort, loss exposure, and willingness to adopt another layer.
- Key discovery question: `Where does the current ERP or DMS workflow stop, and what reconciliation is still performed manually outside it?`
- Additional named competitors or adjacent platforms supplied during review:
  - Pharmarack is a strong direct or near-direct competitor for the current concept. Its official product material describes automated secondary stock and sales collection through TruSales, AI-assisted return-order creation through PharmScan, stockist ordering, invoices, schemes, claims, and market intelligence.
  - SANeForce is a strong competitor in pharma sales execution. Its official primary and secondary sales module covers structured primary and secondary orders, approvals, pricing controls, invoice readiness, and tracking. Its site displays Micro Labs among customer logos, making Micro Labs' existing SANeForce use an essential discovery topic before any pitch.
  - Entero Healthcare Solutions is primarily a large technology-driven healthcare distributor rather than only a software vendor, but its Entero Direct platform overlaps with manufacturer-distributor connectivity, orders, sales, payments, deliveries, returns, inventory tracking, secondary insights, and claims settlement.
- Before approaching Micro Labs, ask what SANeForce modules it uses today, what information flows into or out of those modules, and which reconciliation work remains outside SANeForce.
- Market credibility evidence reviewed on October 29, 2026:
  - Pharmarack publicly reports a network of roughly 15,900 distributors and 230,000 chemists; third-party company-data sources report an active company with FY2024 revenue. Treat its product claims as credible but confirm customer references during discovery.
  - SANeForce publicly reports more than 1,260 customers, 235,000 users, and operations in more than 60 countries. Its testimonials include a Micro Labs senior executive describing SAN SFE use since 2021, although this does not prove which other SANeForce modules Micro Labs currently licenses.
  - Entero is a listed operating company rather than an early-stage software name. Its FY2025 annual report describes ₹5,096 crore consolidated revenue, 101 warehouses, more than 95,300 retail-pharmacy customers, more than 3,600 hospital customers, and relationships with more than 2,700 manufacturers.
- Recommended positioning hypothesis: do not rebuild field-force reporting, ordering, distributor commerce, or physical distribution. Integrate with those systems and specialize in evidence-linked reconciliation, exception explanation, financial exposure, cross-team resolution, and audit closure.
- This positioning remains a hypothesis until prospective users confirm that existing systems leave material reconciliation work outside them.
- Detailed overlap review:
  - Pharmarack PharmScan is more directly competitive than initially understood. Its public workflow says a CFA operator photographs returned strips, boxes, or loose units; an LLM identifies the product; the system generates product, quantity, and batch data; it matches the return against original invoices; and it triggers credit-note generation with image evidence and timestamps. Do not use generic `AI-powered returns` as PharmaAI's differentiation.
  - SANeForce publishes Essential, Advanced, Professional, and Power tiers and states that pricing depends on monthly active users. It does not publish currency amounts; features, user count, training, migration, and customization affect the quote. Obtain Micro Labs' actual contracted modules and commercial terms before attempting price comparison.
  - Entero's public material says its integrated platform supports ordering, inventory visibility, dispatch, reconciliation, secondary-sales analysis, returns, and claims settlement within its distribution network. It overlaps functionally but is also an operating distribution business, so it is not a like-for-like SaaS comparison.
- Stronger proposed PharmaAI wedge:
  1. Integrate with the ERP, DMS, SANeForce, Pharmarack, and distributor files already in use rather than replacing transaction capture.
  2. Reconcile evidence across systems and show the exact invoice line, return line, policy rule, approval, and issued credit supporting every result.
  3. Automatically clear deterministic matches and create human work only for exceptions.
  4. Track approved return cases through actual finance credit issuance and closure; expose outstanding financial value and ownership.
  5. Use AI for messy-document extraction, entity resolution, evidence-linked explanations, anomaly-pattern detection, and prioritization—not for arithmetic, policy enforcement, or final approval.
- Price should not be the primary wedge until competitor quotes and switching costs are known. Compete first on measurable time saved, faster case closure, lower outstanding-credit exposure, and the ability to operate across existing systems.
- SANeForce AI review:
  - SAN ONE is marketed as AI-powered MR reporting, but most described capabilities are field-operation tools such as visit reporting, tour planning, expenses, samples, orders, campaigns, dashboards, and primary or secondary sales capture.
  - The most concrete documented AI capability is `AI nudges and predictive recommendations`: use visit logs, prescription trends, sample distribution, expense entries, and geo-tagged activity to recommend priority doctors or stockists, highlight missed and pending visits, and guide field routes.
  - SAN ZEN is marketed as AI-powered e-detailing and personalization for doctor engagement, although its public pages provide less technical detail about the underlying AI.
  - SANeForce's public material does not clearly demonstrate AI for distributor inventory reconciliation or returns-to-credit reconciliation. Confirm this directly during a demo rather than assuming absence.
  - The Micro Labs testimonial specifically mentions field operations, mobile access, sample distribution, and representative evaluation. It does not establish that Micro Labs uses SANeForce's primary/secondary sales or newer AI modules.
- Entero technology and AI review:
  - Entero is primarily an operating pharmaceutical distribution company, supported by its own technology stack, rather than a neutral software-only vendor.
  - Entero Direct supports orders, tracking, payments, real-time inventory visibility, returns, and claims settlement across Entero's network.
  - Entero ERP supports inventory, sales, promotion management, accounting, and regulatory processes. Teqtic harmonizes product codes and provides customized sales, purchase, distributor, warehouse, proof-of-delivery, and inventory reporting.
  - Entero supplies manufacturers with secondary sales, inventory, micro-market, and brand-performance insights. Its prospectus refers to AI-based analytics used to customize offers, market reach, demand forecasting, and internal operational optimization.
  - Public material does not clearly describe a conversational AI assistant or evidence-cited cross-system exception workflow, but do not assume absence without a product demonstration.
  - Potential PharmaAI advantage over Entero: operate as a distributor-neutral layer across the manufacturer's full channel, including Entero and unrelated distributors; reconcile data from multiple systems; expose evidence and financial exposure; and provide conversational analysis with cited records.

## Product goal reset

- Do not define the product as a generic system that prevents all sales or returns leakage. Define two separate, testable controls.
- Returns control goal: ensure a distributor return is supported by an original manufacturer sale, satisfies the manufacturer's return policy, receives an explicit approval decision, and is followed by the correct issued credit.
- Minimum returns evidence: manufacturer sales invoice or invoice-line data, distributor return claim, applicable policy or rule, reviewer decision, and issued credit note. A return claim alone cannot be reconciled.
- Sales and inventory control goal: identify unexplained differences between the distributor's expected closing inventory and the closing inventory the distributor reports.
- Minimum sales and inventory evidence: opening distributor inventory, manufacturer shipments or primary sales to the distributor, distributor secondary sales, returns and other stock movements, and distributor-reported closing inventory. Primary sales alone cannot produce a reconciliation.
- Treat these as two separate workflows sharing master data, imports, review, reporting, and audit infrastructure. Do not merge their logic merely because both involve distributors.
- Before further UI or backend work, validate whether manufacturers can obtain these inputs reliably and whether the resulting reconciliation is currently manual, costly, and important enough to buy.

