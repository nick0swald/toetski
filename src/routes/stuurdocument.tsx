import { createFileRoute } from "@tanstack/react-router";
import { AppShell, Page, PageIntro } from "@/components/layout/app-shell";
import { StuurEditor } from "@/components/toets/stuur-editor";

export const Route = createFileRoute("/stuurdocument")({ component: StuurPage });

function StuurPage() {
  return (
    <AppShell>
      <Page>
        <PageIntro title="Constructie">
          Achter de schermen. Deze regels stuurt de maker; ze horen niet in het docentbeeld.
        </PageIntro>
        <section className="rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8">
          <StuurEditor />
        </section>
      </Page>
    </AppShell>
  );
}
