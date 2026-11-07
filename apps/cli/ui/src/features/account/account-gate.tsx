import type { ReactNode } from "react";
import { Link, Navigate } from "@tanstack/react-router";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/features/account/use-account";

/**
 * Keep the workspace unmounted until the CLI has a signed-in account.
 */
export function AccountGate({ children }: { children: ReactNode }) {
  const account = useAccount();
  const state = account.data?.state;
  const unavailable = state === "unavailable" || account.isError;
  const errorMessage = state === "unavailable"
    ? account.data?.error
    : account.error instanceof Error ? account.error.message : undefined;

  if (state === "signed_in") return <>{children}</>;
  if (state === "signed_out") return <Navigate to="/" replace />;

  return <main className="page-container"><section className="panel account-gate">
    {unavailable
      ? <>
          <h1>The workspace is unavailable</h1>
          <p>{errorMessage ?? "The account service could not be reached."}</p>
          <Button onClick={() => void account.refetch()}>Try again</Button>
        </>
      : <>
          <LogIn size={24} aria-hidden="true" />
          <h1 role="status">Checking your account…</h1>
          <p>Validating your saved session.</p>
        </>}
    <Link to="/">Back to home</Link>
  </section></main>;
}
