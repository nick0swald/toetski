import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { cesuurPunten, formuleTekst } from "@/lib/toets/cijfer";
import { withDefaults } from "@/lib/toets/defaults";
import { herbouwMatrijs, totaalPunten } from "@/lib/toets/rtti";
import { maakVoorbeeldToets } from "@/lib/toets/sample";
import type { CijferNorm, GegenereerdeToets, NakijkItem, Vraag } from "@/lib/toets/types";

const VOORBEELD_ID = "voorbeeld-fotosynthese";

function normalizeToets(t: GegenereerdeToets): GegenereerdeToets {
  const next = withDefaults(herbouwMatrijs(t));
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
  updateNakijk: (id: string, nummer: number, patch: Partial<NakijkItem>) => void;
  updateCijferNorm: (id: string, norm: CijferNorm) => void;
  remove: (id: string) => void;
  byId: (id: string) => GegenereerdeToets | undefined;
  ensureVoorbeeld: () => GegenereerdeToets;
};

export const TOETS_STORE_KEY = "ares058-toetsmaker";

/** Sync current store slice to localStorage before client navigates. */
export function flushToetsPersist(): void {
  if (typeof localStorage === "undefined") return;
  const s = useToetsStore.getState();
  localStorage.setItem(
    TOETS_STORE_KEY,
    JSON.stringify({
      state: {
        toetsen: s.toetsen,
        stuurdocument: s.stuurdocument,
      },
      version: 0,
    }),
  );
}

export const useToetsStore = create<ToetsStore>()(
  persist(
    (set, get) => ({
      toetsen: [],
      stuurdocument: "",
      setStuurdocument: (tekst) => set({ stuurdocument: tekst.trim() }),
      resetStuurdocument: () => set({ stuurdocument: "" }),
      upsert: (t) => {
        const next = normalizeToets(t);
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
            t.id === id ? normalizeToets({ ...t, ...patch, id: t.id }) : t,
          ),
        }));
      },
      updateVraag: (id, nummer, patch) => {
        set((s) => ({
          toetsen: s.toetsen.map((t) => {
            if (t.id !== id) return t;
            const vragen = t.vragen.map((q) => (q.nummer === nummer ? { ...q, ...patch } : q));
            return normalizeToets({ ...t, vragen });
          }),
        }));
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
      name: TOETS_STORE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        toetsen: s.toetsen,
        stuurdocument: s.stuurdocument,
      }),
      merge: (persisted, current) => {
        const p = persisted as { toetsen?: GegenereerdeToets[]; stuurdocument?: string } | undefined;
        const toetsen = Array.isArray(p?.toetsen)
          ? p.toetsen.map((t) => normalizeToets(t))
          : current.toetsen;
        return {
          ...current,
          toetsen,
          stuurdocument: typeof p?.stuurdocument === "string" ? p.stuurdocument : current.stuurdocument,
        };
      },
    },
  ),
);
