import type { PropsWithChildren, ReactNode } from "react";
import { Navigation } from "./Navigation";

type PageShellProps = PropsWithChildren<{
  title: ReactNode;
  backToHome?: boolean;
  headerRight?: ReactNode;
}>;

export function PageShell({ title, children, headerRight }: PageShellProps) {
  return (
    <main className="page-wrap">
      <section className="page">
        <header className={headerRight ? "page-header page-header--with-controls" : "page-header"}>
          <h1>{title}</h1>
          {headerRight && <div className="page-header-controls">{headerRight}</div>}
        </header>
        {children}
      </section>
      <Navigation />
    </main>
  );
}
