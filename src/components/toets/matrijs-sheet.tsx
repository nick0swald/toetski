import { RTTI_META, RTTI_ORDER } from "@/lib/toets/constants";
import { cesuurPunten } from "@/lib/toets/cijfer";
import { totaalPunten } from "@/lib/toets/rtti";
import type { GegenereerdeToets } from "@/lib/toets/types";
import { withDefaults } from "@/lib/toets/defaults";
import { leerdoelDekking } from "@/lib/toets/leerdoelen-plan";

export function MatrijsSheet({ toets }: { toets: GegenereerdeToets }) {
  const t = withDefaults(toets);
  const { matrijs } = t;
  const max = totaalPunten(t.vragen);
  const cesuur = cesuurPunten(max, t.cijferNorm);
  const ld = leerdoelDekking(t.vragen, t.leerdoelen);
  return (
    <article className="rounded-[var(--radius-xl)] bg-paper p-6 sm:p-8">
      <h2 className="text-2xl font-bold text-brand">Toetsmatrijs · schriftelijke toets</h2>
      <p className="mt-1 text-sm text-muted">RTTI · versie {t.meta.versie}</p>

      <dl className="mt-6 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-brand">Vak</dt>
          <dd>{t.meta.vak || "—"}</dd>
        </div>
        <div>
          <dt className="font-semibold text-brand">Naam toets</dt>
          <dd>{t.meta.titel || "—"}</dd>
        </div>
        <div>
          <dt className="font-semibold text-brand">Leerweg</dt>
          <dd>{t.meta.leerweg}</dd>
        </div>
        <div>
          <dt className="font-semibold text-brand">Toetsvorm</dt>
          <dd>schriftelijke toets</dd>
        </div>
        <div>
          <dt className="font-semibold text-brand">Leerjaar</dt>
          <dd>{t.meta.leerjaar}</dd>
        </div>
        <div>
          <dt className="font-semibold text-brand">Cesuur</dt>
          <dd>
            {cesuur} van de {max} punten ({t.cijferNorm.cesuurPct}%)
          </dd>
        </div>
      </dl>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2 pr-2 font-semibold text-brand">Onderwerpen / toetsdoelen</th>
              <th className="px-2 py-2 font-semibold text-brand">Vragen</th>
              {RTTI_ORDER.map((k) => (
                <th key={k} className="px-2 py-2 font-semibold text-brand">
                  {RTTI_META[k].kort}
                  <span className="block text-xs font-normal text-muted">{RTTI_META[k].naam}</span>
                </th>
              ))}
              <th className="px-2 py-2 font-semibold text-brand">Totaal</th>
            </tr>
          </thead>
          <tbody>
            {matrijs.domeinen.map((d, i) => {
              const row = matrijs.cellen[d];
              const alleVragen = RTTI_ORDER.flatMap((k) => row?.[k]?.vraagnummers ?? []);
              const unieke = [...new Set(alleVragen)].sort((a, b) => a - b);
              const domeinPunten = RTTI_ORDER.reduce((s, k) => s + (row?.[k]?.punten ?? 0), 0);
              const pct = max > 0 ? Math.round((domeinPunten / max) * 100) : 0;
              return (
                <tr key={d} className="border-b border-border">
                  <td className="py-2 pr-2 font-medium">
                    {i + 1}. {d}
                  </td>
                  <td className="px-2 py-2 tabular-nums">{unieke.join(", ") || "—"}</td>
                  {RTTI_ORDER.map((k) => {
                    const cel = row?.[k];
                    return (
                      <td key={k} className="px-2 py-2 tabular-nums">
                        {cel && cel.punten > 0
                          ? `${cel.punten} (${cel.vraagnummers.join(", ")})`
                          : "—"}
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 font-semibold tabular-nums">{pct}%</td>
                </tr>
              );
            })}
            <tr>
              <td className="py-2 pr-2 font-semibold">Totaal</td>
              <td className="px-2 py-2 font-semibold tabular-nums">{t.vragen.length}</td>
              {RTTI_ORDER.map((k) => (
                <td key={k} className="px-2 py-2 font-semibold tabular-nums">
                  {matrijs.totalen[k]?.percentage ?? 0}%
                </td>
              ))}
              <td className="px-2 py-2 font-semibold">100%</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-muted">
        {RTTI_ORDER.map((k) => `${RTTI_META[k].kort} = ${RTTI_META[k].naam}`).join("  ·  ")}
      </p>
      {t.leerdoelen && ld.rijen.length ? (
        <section className="mt-8">
          <h3 className="text-lg font-bold text-brand">Leerdoelen · dekking</h3>
          <p className="mt-1 text-xs text-muted">
            {t.leerdoelen.bronTitel}
            {t.leerdoelen.herkomst ? ` · ${t.leerdoelen.herkomst}` : ""}
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 pr-2 font-semibold text-brand">Leerdoel</th>
                  <th className="px-2 py-2 font-semibold text-brand">Omschrijving</th>
                  <th className="px-2 py-2 font-semibold text-brand">CE/SE</th>
                  <th className="px-2 py-2 font-semibold text-brand">Vragen</th>
                  <th className="px-2 py-2 font-semibold text-brand">Richt p</th>
                  <th className="px-2 py-2 font-semibold text-brand">Toets p</th>
                </tr>
              </thead>
              <tbody>
                {ld.rijen.map((r) => (
                  <tr key={r.id} className="border-b border-border">
                    <td className="py-2 pr-2 font-medium tabular-nums">{r.id}</td>
                    <td className="px-2 py-2">{r.tekst}</td>
                    <td className="px-2 py-2">{r.deel === "KD" ? "kerndoel" : r.deel}</td>
                    <td className="px-2 py-2 tabular-nums">{r.vragen.join(", ") || "—"}</td>
                    <td className="px-2 py-2 tabular-nums">{r.doelPunten}</td>
                    <td className={`px-2 py-2 tabular-nums ${r.punten === 0 ? "font-semibold" : ""}`}>{r.punten}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-sm">
            {ld.ongedekt.length ? `Niet getoetst: ${ld.ongedekt.map((r) => r.id).join(", ")}.` : "Alle leerdoelen van dit hoofdstuk zijn getoetst."}
          </p>
          <p className="mt-1 text-xs text-muted">
            Leerdoel per vraag:{" "}
            {[...ld.perVraag.entries()]
              .sort((a, b) => a[0] - b[0])
              .map(([nr, id]) => `${nr} ${id}`)
              .join(" · ")}
          </p>
        </section>
      ) : null}
    </article>
  );
}
