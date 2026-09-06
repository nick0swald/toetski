import { createFileRoute, useSearch } from "@tanstack/react-router";
import { AppShell, Page } from "@/components/layout/app-shell";
import { FeedbackForm } from "@/components/toets/feedback-form";

export const Route = createFileRoute("/feedback")({ component: FeedbackPage });

function FeedbackPage() {
  const search = useSearch({ strict: false }) as { id?: string };
  return (
    <AppShell>
      <Page>
        <FeedbackForm startId={search.id} />
      </Page>
    </AppShell>
  );
}
