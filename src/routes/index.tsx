import { createFileRoute } from "@tanstack/react-router";
import { AppShell, Page } from "@/components/layout/app-shell";
import { CreateForm } from "@/components/toets/create-form";
import { Library } from "@/components/toets/library";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <AppShell>
      <Page>
        <CreateForm />
        <Library />
      </Page>
    </AppShell>
  );
}
