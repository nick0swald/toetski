import type { MouseEvent, ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LeafMark } from "@/components/brand/mark";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/", label: "Toetsmaker", hint: "Lesstof → toets", exact: true },
  { to: "/matrijsmaker", label: "Matrijsmaker", hint: "RTTI-matrijs", exact: false },
  { to: "/cijfer", label: "Cijfer", hint: "Normering", exact: false },
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
      <header className={cn("sticky top-0 z-40 pt-3 sm:pt-4", printHidden && "print:hidden")}>
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="poki-pill-header flex h-14 items-center justify-between px-4 sm:h-16 sm:px-5">
            <Brand />
            <span
              className="rounded-full bg-bg px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-brand sm:text-xs"
              title='Visuele testballon — data-theme="poki-balloon" uitzetten = klassiek terug'
            >
              testballon
            </span>
          </div>
          <nav aria-label="Hoofdmenu" className="mt-3 grid grid-cols-3 gap-2 sm:mt-4 sm:gap-3">
            {TABS.map((tab) => (
              <NavItem key={tab.to} to={tab.to} exact={tab.exact} hint={tab.hint}>
                {tab.label}
              </NavItem>
            ))}
          </nav>
        </div>
        <div className="h-3 sm:h-4" />
      </header>
      <div id="inhoud">{children}</div>
      <footer
        className={cn("mx-auto max-w-5xl px-4 pb-10 pt-1 sm:px-6", printHidden && "print:hidden")}
      >
        <div className="poki-card border border-border p-4 sm:p-5">
          <p className="text-sm leading-relaxed text-muted">
            <Link
              to="/werkwijze"
              className="inline-flex rounded-full bg-bg px-3 py-1 font-bold text-brand hover:opacity-90"
            >
              Werkwijze
            </Link>
            {" · "}Ares058 VMBO Leeuwarden · docent controleert altijd inhoud en cesuur.
          </p>
        </div>
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
      <span className="flex size-9 items-center justify-center rounded-full bg-bg">
        <LeafMark className="size-6 shrink-0" />
      </span>
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
  hint,
}: {
  to: "/" | "/matrijsmaker" | "/cijfer";
  children: ReactNode;
  exact?: boolean;
  hint: string;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = exact ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);

  return (
    <Link
      to={to}
      data-active={active ? "true" : "false"}
      aria-current={active ? "page" : undefined}
      className="poki-nav-tile flex min-h-[4.5rem] flex-col items-start justify-center gap-0.5 px-3 py-3 text-left text-brand sm:min-h-[5.25rem] sm:px-4"
    >
      <span className="text-sm font-bold uppercase leading-tight tracking-wide sm:text-base">
        {children}
      </span>
      <span className="text-[11px] font-medium normal-case opacity-65 sm:text-xs">{hint}</span>
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
    <main
      className={cn(
        "mx-auto min-w-0 max-w-5xl overflow-x-clip px-4 py-2 sm:px-6 sm:py-3",
        className,
      )}
    >
      <div className="poki-card border border-border/60 p-5 sm:p-7">{children}</div>
    </main>
  );
}

export function PageIntro({
  title,
  children,
  className,
}: {
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 min-h-[6.75rem] sm:min-h-[7.25rem]", className)}>
      <h1 className="text-3xl font-bold tracking-tight text-brand sm:text-4xl">{title}</h1>
      {children ? (
        <p className="mt-3 max-w-xl text-pretty leading-relaxed text-muted">{children}</p>
      ) : (
        <p className="mt-3">&nbsp;</p>
      )}
    </header>
  );
}
