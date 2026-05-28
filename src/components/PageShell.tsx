import type { PropsWithChildren } from "react";
import { Navigation } from "./Navigation";

type PageShellProps = PropsWithChildren<{
  title: string;
  backToHome?: boolean;
}>;

export function PageShell({ title, children }: PageShellProps) {
  return (
    <main className="page-wrap">
      <section className="page">
        <header className="page-header">
          <h1>{title}</h1>
        </header>
        {children}
      </section>
      <Navigation />
    </main>
  );
}
