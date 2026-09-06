import { create } from "zustand";
import { persist } from "zustand/middleware";
import { herbouwMatrijs } from "@/lib/toets/rtti";
import { maakVoorbeeldNaskToets, maakVoorbeeldToets } from "@/lib/toets/sample";
import { withDefaults } from "@/lib/toets/defaults";
import type { CijferNorm, GegenereerdeToets, Vraag } from "@/lib/toets/types";

interface ToetsState {
  toetsen: GegenereerdeToets[];
  upsert: (toets: GegenereerdeToets) => void;
  update: (id: string, patch: Partial<GegenereerdeToets>) => void;
  updateVraag: (id: string, nummer: number, patch: Partial<Vraag>) => void;
  updateNakijk: (
    id: string,
    nummer: number,
    patch: Partial<GegenereerdeToets["nakijkmodel"][number]>,
  ) => void;
  updateCijferNorm: (id: string, norm: CijferNorm) => void;
  remove: (id: string) => void;
  byId: (id: string) => GegenereerdeToets | undefined;
  ensureVoorbeeld: () => GegenereerdeToets;
  ensureVoorbeeldNask: () => GegenereerdeToets;
}

export const useToetsStore = create<ToetsState>()(
  persist(
    (set, get) => ({
      toetsen: [],
      upsert: (toets) =>
        set((s) => ({
          toetsen: [withDefaults(toets), ...s.toetsen.filter((t) => t.id !== toets.id)],
        })),
      update: (id, patch) =>
        set((s) => ({
          toetsen: s.toetsen.map((t) =>
            t.id === id ? herbouwMatrijs(withDefaults({ ...t, ...patch })) : t,
          ),
        })),
      updateVraag: (id, nummer, patch) =>
        set((s) => ({
          toetsen: s.toetsen.map((t) => {
            if (t.id !== id) return t;
            const vragen = t.vragen.map((q) =>
              q.nummer === nummer ? { ...q, ...patch } : q,
            );
            return herbouwMatrijs(withDefaults({ ...t, vragen }));
          }),
        })),
      updateNakijk: (id, nummer, patch) =>
        set((s) => ({
          toetsen: s.toetsen.map((t) => {
            if (t.id !== id) return t;
            return withDefaults({
              ...t,
              nakijkmodel: t.nakijkmodel.map((n) =>
                n.nummer === nummer ? { ...n, ...patch } : n,
              ),
            });
          }),
        })),
      updateCijferNorm: (id, norm) =>
        set((s) => ({
          toetsen: s.toetsen.map((t) => {
            if (t.id !== id) return t;
            return withDefaults({ ...t, cijferNorm: norm });
          }),
        })),
      remove: (id) =>
        set((s) => ({ toetsen: s.toetsen.filter((t) => t.id !== id) })),
      byId: (id) => {
        const t = get().toetsen.find((x) => x.id === id);
        return t ? withDefaults(t) : undefined;
      },
      ensureVoorbeeld: () => {
        const existing = get().toetsen.find((t) => t.id === "voorbeeld-fotosynthese");
        if (existing) return withDefaults(existing);
        const sample = maakVoorbeeldToets();
        set((s) => ({ toetsen: [sample, ...s.toetsen] }));
        return sample;
      },
      ensureVoorbeeldNask: () => {
        const existing = get().toetsen.find((t) => t.id === "voorbeeld-nask-kas");
        if (existing) return withDefaults(existing);
        const sample = maakVoorbeeldNaskToets();
        set((s) => ({ toetsen: [sample, ...s.toetsen] }));
        return sample;
      },
    }),
    { name: "aeres-toetsmaker" },
  ),
);
