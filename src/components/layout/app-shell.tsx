import type { MouseEvent, ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { LeafMark } from "@/components/brand/mark";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/", label: "Toets maken", exact: true },
  { to: "/cijfer", label: "Cijfer berekenen" },
  { to: "/matrijsmaker", label: "Matrijsmaker" },
  { to: "/feedback", label: "Feedback" },
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
      <header className={cn("sticky top-0 z-40 bg-bg", printHidden && "print:hidden")}>
        <div className="mx-auto max-w-3xl px-5 sm:px-6">
          <div className="flex h-14 items-center sm:h-16">
            <Brand />
          </div>
          <nav
            aria-label="Hoofdmenu"
            className="grid grid-cols-2 gap-1 rounded-[var(--radius-lg)] bg-surface p-1 sm:grid-cols-4"
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
        className={cn("mx-auto max-w-3xl px-5 pb-10 pt-2 sm:px-6", printHidden && "print:hidden")}
      >
        <p className="text-sm leading-relaxed text-muted">
          <Link to="/werkwijze" className="font-semibold text-brand hover:opacity-80">
            Werkwijze
          </Link>
          {" · "}Ares058 VMBO Leeuwarden · docent controleert altijd inhoud en cesuur.
        </p>
      </footer>
    </div>
  );
}

const brandTaps: { n: number; at: number; homeTimer: number } = { n: 0, at: 0, homeTimer: 0 };

function Brand() {
  const navigate = useNavigate();

  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    const now = Date.now();
    if (now - brandTaps.at > 2000) brandTaps.n = 0;
    brandTaps.at = now;
    brandTaps.n += 1;
    if (brandTaps.homeTimer) window.clearTimeout(brandTaps.homeTimer);
    if (brandTaps.n >= 5) {
      brandTaps.n = 0;
      void navigate({ to: "/stuurdocument" });
      return;
    }
    brandTaps.homeTimer = window.setTimeout(() => {
      brandTaps.n = 0;
      void navigate({ to: "/" });
    }, 450);
  }

  return (
    <Link to="/" onClick={onClick} className="flex items-center gap-2.5 text-brand">
      <LeafMark className="size-8 shrink-0" />
      <span className="text-lg tracking-tight sm:text-xl">
        <span className="font-bold">Ares058</span> <span className="font-medium">Toetsmaker</span>
      </span>
    </Link>
  );
}

function NavItem({
  to,
  children,
  exact,
}: {
  to: "/" | "/cijfer" | "/matrijsmaker" | "/feedback";
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
      <h1 className="text-3xl font-bold tracking-tight text-brand sm:text-4xl">{title}</h1>
      {children ? (
        <p className="mt-3 max-w-xl text-pretty leading-relaxed text-muted">{children}</p>
      ) : null}
    </header>
  );
}
