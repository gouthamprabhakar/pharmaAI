import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
export default function NotFound() {
  return (
    <main className="auth-page">
      <div className="auth-form">
        <h1>Page not found</h1>
        <p className="auth-description">
          This page isn’t available. Return to PharmaAI to explore the sample
          data.
        </p>
        <Link href="/" className={buttonVariants()}>
          Back to PharmaAI
        </Link>
      </div>
    </main>
  );
}
