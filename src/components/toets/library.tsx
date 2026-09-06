import { Link, useNavigate } from "@tanstack/react-router";
import { FileDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { withDefaults } from "@/lib/toets/defaults";
import { useToetsStore } from "@/store/toets-store";

export function Library() {
  const toetsen = useToetsStore((s) => s.toetsen);
  const remove = useToetsStore((s) => s.remove);
  const ensureVoorbeeld = useToetsStore((s) => s.ensureVoorbeeld);
  const ensureVoorbeeldNask = useToetsStore((s) => s.ensureVoorbeeldNask);
  const navigate = useNavigate();

  return (
    <section className="mt-5 min-w-0 rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-brand">Opgeslagen</h2>
          <p className="mt-2 leading-relaxed text-muted">
            Blijft op dit apparaat. Tik Voorbeeld voor een kant-en-klare toets,
            zonder te wachten.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              const t = ensureVoorbeeld();
              navigate({ to: "/toets/$id", params: { id: t.id } });
            }}
          >
            Voorbeeld
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              const t = ensureVoorbeeldNask();
              navigate({ to: "/toets/$id", params: { id: t.id } });
            }}
          >
            Voorbeeld NaSk
          </Button>
        </div>
      </div>

      {toetsen.length === 0 ? (
        <p className="mt-5 leading-relaxed text-muted">Nog geen toetsen op dit apparaat.</p>
      ) : (
        <ul className="mt-5">
          {toetsen.map((t) => (
            <li
              key={t.id}
              className="flex items-center gap-3 border-t border-brand/10 py-2 first:border-t-0 first:pt-0"
            >
              <Link
                to="/toets/$id"
                params={{ id: t.id }}
                className="min-w-0 flex-1 py-2"
              >
                <p className="truncate font-semibold text-brand">{t.meta.titel}</p>
                <p className="mt-0.5 text-sm text-muted">
                  {t.soort === "matrijs" ? "Matrijs · " : ""}
                  {t.meta.vak} · {t.meta.leerweg} {t.meta.leerjaar} ·{" "}
                  {t.meta.versie ?? "A"}
                </p>
              </Link>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Word-pakket"
                onClick={async () => {
                  const full = withDefaults(t);
                  if (full.soort === "matrijs") {
                    const { downloadMatrijsDocx } = await import("@/lib/toets/docx-export");
                    await downloadMatrijsDocx(full);
                    return;
                  }
                  const { downloadPakketDocx } = await import("@/lib/toets/docx-export");
                  await downloadPakketDocx(full);
                }}
              >
                <FileDown className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Verwijderen"
                onClick={() => remove(t.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
