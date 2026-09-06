import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, Page, PageIntro } from "@/components/layout/app-shell";
import { CijferPanel } from "@/components/toets/cijfer-panel";
import { DEFAULT_CIJFER } from "@/lib/toets/cijfer";
import type { CijferNorm } from "@/lib/toets/types";

export const Route = createFileRoute("/cijfer")({ component: CijferPage });

function CijferPage() {
  const [max, setMax] = useState(40);
  const [norm, setNorm] = useState<CijferNorm>(DEFAULT_CIJFER);

  return (
    <AppShell>
      <Page>
        <PageIntro title="Cijfer berekenen">
          Punten omzetten zonder een toets te maken. De tabel download je als
          Word.
        </PageIntro>
        <div className="rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8">
          <CijferPanel
            titel=""
            max={max}
            maxEditable
            onMaxChange={setMax}
            norm={norm}
            onChange={setNorm}
            onExport={async () => {
              try {
                const { downloadCijferTabelDocx } = await import("@/lib/toets/docx-export");
                await downloadCijferTabelDocx({
                  titel: "Cijferomzetting",
                  max,
                  norm,
                });
                toast.success("Word-bestand gedownload");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Download mislukt");
              }
            }}
          />
        </div>
      </Page>
    </AppShell>
  );
}
