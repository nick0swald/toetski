import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { cesuurPunten, formuleTekst } from "@/lib/toets/cijfer";
import { withDefaults } from "@/lib/toets/defaults";
import { herbouwMatrijs, totaalPunten } from "@/lib/toets/rtti";
import { maakVoorbeeldToets } from "@/lib/toets/sample";
import { bewaakFiguren, diepBevriezen } from "@/lib/toets/figuren/bevriezing";
import { verwijderFiguur as zonderFiguur } from "@/lib/toets/figuren/verwijder";
import type { CijferNorm, GegenereerdeToets, NakijkItem, Vraag } from "@/lib/toets/types";

const VOORBEELD_ID = "voorbeeld-fotosynthese";

/** Bevroren figuren blijven bevroren (ook na rehydrate uit localStorage). */
function bevriesFiguren(t: GegenereerdeToets): GegenereerdeToets {
  for (const q of t.vragen ?? []) if (q.figuur) diepBevriezen(q.figuur);
  return t;
}

/** Harde regel: een goedgekeurde figuur wordt door geen enkele store-update gewijzigd. */
function bewaak(prev: GegenereerdeToets | undefined, next: GegenereerdeToets): GegenereerdeToets {
  if (!prev) return next;
  const heeftFiguren = prev.vragen.some((q) => q.figuur) || next.vragen.some((q) => q.figuur || q.figuurId);
  if (!heeftFiguren) return next;
  const r = bewaakFiguren(prev.vragen, next.vragen, { pijplijn: Boolean(next.figuurPijplijn ?? prev.figuurPijplijn) });
  return { ...next, vragen: r.vragen };
}

function normalizeToets(t: GegenereerdeToets): GegenereerdeToets {
  const next = withDefaults(herbouwMatrijs(bevriesFiguren(t)));
  const max = totaalPunten(next.vragen);
  return {
    ...next,
    cesuur: {
      ...next.cesuur,
      cesuurPunten: cesuurPunten(max, next.cijferNorm),
      formule: formuleTekst(next.cijferNorm, max),
    },
  };
}

export type ToetsStore = {
  toetsen: GegenereerdeToets[];
  stuurdocument: string;
  setStuurdocument: (tekst: string) => void;
  resetStuurdocument: () => void;
  upsert: (t: GegenereerdeToets) => void;
  update: (id: string, patch: Partial<GegenereerdeToets>) => void;
  updateVraag: (id: string, nummer: number, patch: Partial<Vraag>) => void;
  /** Docent verwijdert de (goedgekeurde) figuur bij één vraag. Alleen verwijderen, nooit wijzigen. */
  verwijderFiguur: (id: string, nummer: number) => void;
  updateNakijk: (id: string, nummer: number, patch: Partial<NakijkItem>) => void;
  updateCijferNorm: (id: string, norm: CijferNorm) => void;
  remove: (id: string) => void;
  byId: (id: string) => GegenereerdeToets | undefined;
  ensureVoorbeeld: () => GegenereerdeToets;
};

export const useToetsStore = create<ToetsStore>()(
  persist(
    (set, get) => ({
      toetsen: [],
      stuurdocument: "",
      setStuurdocument: (tekst) => set({ stuurdocument: tekst.trim() }),
      resetStuurdocument: () => set({ stuurdocument: "" }),
      upsert: (t) => {
        const next = normalizeToets(bewaak(get().toetsen.find((x) => x.id === t.id), t));
        set((s) => {
          const i = s.toetsen.findIndex((x) => x.id === next.id);
          const toetsen =
            i >= 0 ? s.toetsen.map((x, idx) => (idx === i ? next : x)) : [next, ...s.toetsen];
          return { toetsen };
        });
      },
      update: (id, patch) => {
        set((s) => ({
          toetsen: s.toetsen.map((t) =>
            t.id === id ? normalizeToets(bewaak(t, { ...t, ...patch, id: t.id })) : t,
          ),
        }));
      },
      updateVraag: (id, nummer, patch) => {
        set((s) => ({
          toetsen: s.toetsen.map((t) => {
            if (t.id !== id) return t;
            // figuur/figuurId zijn nooit via een patch te wijzigen.
            const { figuur: _f, figuurId: _i, figuurVerwijderd: _v, ...veilig } = patch;
            const vragen = t.vragen.map((q) => (q.nummer === nummer ? { ...q, ...veilig } : q));
            return normalizeToets({ ...t, vragen });
          }),
        }));
      },
      verwijderFiguur: (id, nummer) => {
        const t = get().toetsen.find((x) => x.id === id);
        if (!t) return;
        get().upsert(zonderFiguur(t, nummer));
      },
      updateNakijk: (id, nummer, patch) => {
        set((s) => ({
          toetsen: s.toetsen.map((t) => {
            if (t.id !== id) return t;
            const nakijkmodel = t.nakijkmodel.map((n) =>
              n.nummer === nummer ? { ...n, ...patch } : n,
            );
            return withDefaults({ ...t, nakijkmodel });
          }),
        }));
      },
      updateCijferNorm: (id, norm) => {
        set((s) => ({
          toetsen: s.toetsen.map((t) =>
            t.id === id ? normalizeToets({ ...t, cijferNorm: norm }) : t,
          ),
        }));
      },
      remove: (id) => {
        set((s) => ({ toetsen: s.toetsen.filter((t) => t.id !== id) }));
      },
      byId: (id) => get().toetsen.find((t) => t.id === id),
      ensureVoorbeeld: () => {
        const existing = get().toetsen.find((t) => t.id === VOORBEELD_ID);
        if (existing) return existing;
        const voorbeeld = normalizeToets(maakVoorbeeldToets());
        set((s) => ({ toetsen: [voorbeeld, ...s.toetsen] }));
        return voorbeeld;
      },
    }),
    {
      name: "ares058-toetsmaker",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        toetsen: s.toetsen,
        stuurdocument: s.stuurdocument,
      }),
      merge: (persisted, current) => {
        const p = persisted as { toetsen?: GegenereerdeToets[]; stuurdocument?: string } | undefined;
        const persistedToetsen = Array.isArray(p?.toetsen)
          ? p.toetsen.map((t) => normalizeToets(t))
          : [];
        // In-memory wins on id collision so a late rehydrate cannot wipe a fresh upsert.
        const byId = new Map<string, GegenereerdeToets>();
        for (const t of persistedToetsen) byId.set(t.id, t);
        for (const t of current.toetsen) byId.set(t.id, t);
        return {
          ...current,
          toetsen: Array.from(byId.values()),
          stuurdocument: typeof p?.stuurdocument === "string" ? p.stuurdocument : current.stuurdocument,
        };
      },
    },
  ),
);

/** Wait until persist has hydrated, then re-upsert so navigation cannot lose the toets. */
export async function persistToetsBeforeNavigate(toets: GegenereerdeToets): Promise<string> {
  const id = toets?.id?.trim();
  if (!id) throw new Error("Gegenereerde toets mist een id.");
  useToetsStore.getState().upsert(toets);
  await new Promise<void>((resolve) => {
    if (useToetsStore.persist.hasHydrated()) {
      resolve();
      return;
    }
    const unsub = useToetsStore.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
  });
  // Re-apply after hydration so a late merge cannot drop this toets.
  useToetsStore.getState().upsert(toets);
  // localStorage writes are sync; yield one tick so subscribers see the update.
  await Promise.resolve();
  return id;
}
