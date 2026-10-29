import Link from "next/link";

export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="PharmaAI home">
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
      >
        <path d="M8 3h15v19H4V7a4 4 0 0 1 4-4Z" fill="#146d65" />
        <path d="M12 10h18v15a4 4 0 0 1-4 4H12V10Z" fill="#169780" />
        <path d="M12 10h11v12H12z" fill="white" />
        <path d="m10 16 5 5L26 9" stroke="white" strokeWidth="3" />
        <path d="m13 15 3 3 6-6" stroke="#146d65" strokeWidth="2" />
      </svg>
      <span>
        Pharma<span className="brand-accent">AI</span>
      </span>
    </Link>
  );
}
