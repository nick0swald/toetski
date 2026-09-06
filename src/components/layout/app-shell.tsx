import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { LeafMark } from "@/components/brand/mark";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/", label: "Toets maken", exact: true },
  { to: "/cijfer", label: "Cijfer berekenen" },
  { to: "/matrijsmaker", label: "Matrijsmaker" },
] as const;

export function AppShell({
  children,
  printHidden,
}: {
  children: ReactNode;
  printHidden?: boolean;
}) {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <a
        href="#inhoud"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-[var(--radius-md)] focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-fg"
      >
        Naar inhoud
      </a>
      <header
        className={cn("sticky top-0 z-40 bg-bg", printHidden && "print:hidden")}
      >
        <div className="mx-auto max-w-3xl px-5 sm:px-6">
          <div className="flex h-14 items-center sm:h-16">
            <Link to="/" className="flex min-w-0 items-center gap-2.5 text-brand">
              <LeafMark className="size-8 shrink-0" />
              <span className="truncate text-xl tracking-tight">
                <span className="font-bold">Aeres</span>{" "}
                <span className="font-medium">Toetsmaker</span>
              </span>
            </Link>
          </div>
          <nav
            aria-label="Hoofdmenu"
            className="grid grid-cols-3 gap-1 rounded-[var(--radius-lg)] bg-surface p-1"
          >
            {TABS.map((tab) => (
              <NavItem key={tab.to} to={tab.to} exact={"exact" in tab && tab.exact}>
                {tab.label}
              </NavItem>
            ))}
          </nav>
        </div>
        <div className="h-3" />
      </header>
      <div id="inhoud">{children}</div>
      <footer
        className={cn(
          "mx-auto max-w-3xl px-5 pb-10 pt-2 sm:px-6",
          printHidden && "print:hidden",
        )}
      >
        <p className="text-sm leading-relaxed text-muted">
          <Link
            to="/werkwijze"
            className="font-semibold text-brand hover:opacity-80"
          >
            Werkwijze
          </Link>
          {" · "}Constructiehulp · docent controleert altijd inhoud en cesuur.
        </p>
      </footer>
    </div>
  );
}

function NavItem({
  to,
  children,
  exact,
}: {
  to: "/" | "/cijfer" | "/matrijsmaker";
  children: ReactNode;
  exact?: boolean;
}) {
  return (
    <Link
      to={to}
      activeOptions={exact ? { exact: true } : undefined}
      className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] px-2 text-center text-sm leading-tight text-brand/70 hover:text-brand"
      activeProps={{
        className:
          "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-brand px-2 text-center text-sm font-semibold leading-tight text-paper",
      }}
    >
      {children}
    </Link>
  );
}

export function Page({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main className={cn("mx-auto min-w-0 max-w-3xl overflow-x-clip px-5 py-8 sm:px-6 sm:py-10", className)}>
      {children}
    </main>
  );
}

export function PageIntro({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-6">
      <h1 className="text-3xl font-bold tracking-tight text-brand sm:text-4xl">
        {title}
      </h1>
      {children ? (
        <p className="mt-3 max-w-xl text-pretty leading-relaxed text-muted">
          {children}
        </p>
      ) : null}
    </header>
  );
}
