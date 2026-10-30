"use client";

import Link from "next/link";
import { useState, type MouseEvent } from "react";
import { Brand } from "@/components/brand";
import { Icon, type IconName } from "@/components/icon";
import { Button, buttonVariants } from "@/components/ui/button";
import { DetailDialog, type Detail } from "@/components/detail-dialog";

const sampleEvidence: Detail = {
  title: "Sample reconciliation evidence",
  body: "Northstar Medical Distributors · Bengaluru Depot\n\nDistributor return: DRT-2026-1048\nOriginal manufacturer invoice: INV-2026-78142\nManufacturer-issued credit note: CN-2026-8452\n\nExpected credit: ₹21,92,500.00\nIssued credit: ₹18,40,000.00\nOutstanding credit: ₹3,52,500.00\n\nAll records are synthetic demo data. No live system is connected.",
};
const security: Detail = {
  title: "Security & privacy",
  body: "This preview uses fictional sample data only. It does not connect to live manufacturer or distributor systems.\n\nAI assists with reconciliation; your team confirms decisions. No automatic return approvals, credit issuance or inventory changes.",
};
const metrics = [
  { label: "Expected credit", amount: "₹21,92,500.00" },
  { label: "Issued credit", amount: "₹18,40,000.00" },
  { label: "Outstanding credit", amount: "₹3,52,500.00" },
];
const evidence = [
  { title: "Distributor return", id: "DRT-2026-1048" },
  { title: "Original manufacturer invoice", id: "INV-2026-78142" },
  { title: "Manufacturer-issued credit note", id: "CN-2026-8452" },
];
const features: {
  name: string;
  icon: IconName;
  description: string;
  trail: string;
}[] = [
  {
    name: "Returns Recon",
    icon: "return",
    description:
      "Check return eligibility, receipts and approvals against original invoices.\nCompare expected credit with manufacturer-issued credit notes.",
    trail: "Claims → approvals → credits → supporting evidence →",
  },
  {
    name: "Sales Recon",
    icon: "chart",
    description:
      "Reconcile primary sales, reported secondary sales and closing stock.\nInvestigate differences without treating a variance as proof of wrongdoing.",
    trail: "Primary sales → secondary sales → closing stock →",
  },
];

export default function SignupLanding() {
  const [detail, setDetail] = useState<Detail | null>(null);
  const openDetail =
    (content: Detail) => (event: MouseEvent<HTMLButtonElement>) => {
      // Safari does not focus buttons on pointer clicks. Focus the opener so
      // native dialog dismissal restores focus consistently across browsers.
      event.currentTarget.focus();
      setDetail(content);
    };
  const openSample = openDetail(sampleEvidence);
  return (
    <div className="landing-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <div className="page-container header-inner">
          <Brand />
          <nav className="primary-nav" aria-label="Main navigation">
            <a href="#product">Product</a>
            <a href="#how-it-works">How it works</a>
            <button onClick={openDetail(security)}>
              Security &amp; privacy
            </button>
          </nav>
          <div className="header-actions">
            <Link href="/sign-in" className="sign-in-link">
              Sign in
            </Link>
            <Button size="compact" className="header-cta" onClick={openSample}>
              Start with sample data <Icon name="arrow" size={18} />
            </Button>
          </div>
        </div>
      </header>
      <main id="main-content" className="page-container" tabIndex={-1}>
        <section className="hero" aria-labelledby="hero-heading">
          <div className="hero-copy">
            <p className="eyebrow">For Indian pharmaceutical manufacturers</p>
            <h1 id="hero-heading">
              Reconcile every
              <br />
              return, credit and
              <br />
              <span>stock variance.</span>
            </h1>
            <p className="hero-description">
              Bring distributor returns, manufacturer credits and stock reports
              into one evidence-led workflow.
            </p>
            <div className="hero-actions">
              <Button onClick={openSample}>
                Start with sample data <Icon name="arrow" size={18} />
              </Button>
              <Link
                href="/sign-in"
                className={buttonVariants({ variant: "outline" })}
              >
                Sign in
              </Link>
            </div>
            <p className="upload-note">
              <Icon name="document" size={14} />
              Upload-driven. No live system connection required.
            </p>
          </div>
          <section
            className="reconciliation-card"
            aria-labelledby="reconciliation-heading"
          >
            <header className="reconciliation-header">
              <div>
                <h2 id="reconciliation-heading">
                  <Icon name="return" size={18} />
                  Returns reconciliation
                </h2>
                <p>Asterion Life Sciences Ltd.</p>
              </div>
              <div className="demo-meta">
                <span className="badge demo-badge">Synthetic demo</span>
                <p>1 Oct–31 Oct 2026</p>
              </div>
            </header>
            <div className="reconciliation-body">
              <div className="distributor-row">
                <div>
                  <h3>Northstar Medical Distributors</h3>
                  <p>Fictional demo distributor · Bengaluru Depot</p>
                </div>
                <span className="badge credit-badge">Partially credited</span>
              </div>
              <div className="metrics">
                {metrics.map(({ label, amount }, index) => (
                  <div
                    key={label}
                    className={`metric ${index === 2 ? "metric-outstanding" : ""}`}
                  >
                    <h4>{label}</h4>
                    <p className="metric-amount">{amount}</p>
                    <button
                      className="sample-evidence-link"
                      aria-label={`View sample evidence for ${label.toLowerCase()}`}
                      onClick={openSample}
                    >
                      View sample evidence <Icon name="arrow" size={12} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="evidence-heading">
                <h3>Trace every number to its source</h3>
                <button className="text-action" onClick={openSample}>
                  View evidence <span aria-hidden="true">→</span>
                </button>
              </div>
              <ul className="evidence-list">
                {evidence.map(({ title, id }, index) => (
                  <li key={id}>
                    <Icon name={index === 0 ? "return" : "document"} />
                    <div className="evidence-label">
                      <h4>{title}</h4>
                      <p>{id}</p>
                    </div>
                    {index === 0 ? (
                      <span className="badge confirmed-badge">
                        <Icon name="check" size={11} />
                        Confirmed
                      </span>
                    ) : (
                      <button
                        className="text-action source-link"
                        aria-label={`Open source: ${title}`}
                        onClick={openDetail({
                          title,
                          body: `${id}\n\nFictional demo record for Northstar Medical Distributors. This preview contains no uploaded source documents.`,
                        })}
                      >
                        Open source <Icon name="external" size={11} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <aside className="ai-notice">
                <Icon name="sparkle" size={19} />
                <div>
                  <h3>AI assists. Your team confirms.</h3>
                  <p>
                    No automatic return approvals, credit issuance or inventory
                    changes.
                  </p>
                </div>
              </aside>
            </div>
          </section>
        </section>
        <section
          id="how-it-works"
          className="workflow"
          aria-label="How it works"
        >
          <ol>
            {[
              "Upload reports",
              "Verify mappings",
              "Reconcile evidence",
              "Investigate in Review Queue",
            ].map((label, index) => (
              <li key={label}>
                <span className="step-number">0{index + 1}</span>
                <span>{label}</span>
                {index < 3 && <Icon name="arrow" />}
              </li>
            ))}
          </ol>
        </section>
        <section id="product" className="features" aria-label="Product modules">
          {features.map(({ name, icon, description, trail }) => (
            <article className="feature-card" key={name}>
              <div className="feature-heading">
                <span className="feature-icon">
                  <Icon name={icon} size={22} />
                </span>
                <h2>{name}</h2>
              </div>
              <p>{description}</p>
              <button
                className="text-action feature-trail"
                onClick={openDetail({
                  title: name,
                  body: `${description}\n\n${trail}\n\nThis is a product preview. Uploads and reconciliation are not connected yet.`,
                })}
              >
                {trail}
              </button>
            </article>
          ))}
        </section>
      </main>
      <footer className="site-footer">
        <div className="page-container footer-inner">
          <p>All company names and figures shown are fictional demo data.</p>
          <nav aria-label="Footer navigation">
            <button onClick={openDetail(security)}>Privacy</button>
            <button
              onClick={openDetail({
                title: "Terms",
                body: "This is a demonstration of PharmaAI using synthetic data. Production service terms are not configured in this preview.",
              })}
            >
              Terms
            </button>
            <button
              onClick={openDetail({
                title: "Support",
                body: "Support contact details will be available when your workspace is configured.",
              })}
            >
              Support
            </button>
            <span>© 2026 PharmaAI</span>
          </nav>
        </div>
      </footer>
      <DetailDialog detail={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
