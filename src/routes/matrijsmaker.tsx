import { createFileRoute } from "@tanstack/react-router";
import { AppShell, Page } from "@/components/layout/app-shell";
import { MatrijsForm } from "@/components/toets/matrijs-form";

export const Route = createFileRoute("/matrijsmaker")({
  component: MatrijsmakerPage,
});

function MatrijsmakerPage() {
  return (
    <AppShell>
      <Page>
        <MatrijsForm />
      </Page>
    </AppShell>
  );
}
