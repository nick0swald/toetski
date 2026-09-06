import {
  applyVoldoende,
  cesuurPunten,
  huidigeVoldoende,
  modelLabel,
  voldoendeHint,
  type VoldoendeStand,
} from "@/lib/toets/cijfer";
import type { CijferModel, CijferNorm } from "@/lib/toets/types";
import { Choice } from "@/components/ui/choice";
import { CijferCurve } from "./cijfer-curve";

const MODELS: { id: CijferModel; label: string; hint: string }[] = [
  { id: "lineair", label: "Lineair", hint: "1,0–10,0, elk punt telt even zwaar" },
  { id: "gebroken", label: "Gebroken", hint: "Knikpunt bij de 5,5" },
  { id: "exponentieel", label: "Exponentieel", hint: "Kromme: midden zwaarder of lichter" },
];

const STANDEN: { id: VoldoendeStand; label: string }[] = [
  { id: "makkelijker", label: "Makkelijker" },
  { id: "normaal", label: "Normaal" },
  { id: "moeilijker", label: "Moeilijker" },
];

export function CijferNormControls({
  value,
  onChange,
  max,
  showCurve = true,
}: {
  value: CijferNorm;
  onChange: (n: CijferNorm) => void;
  max: number;
  showCurve?: boolean;
}) {
  const stand = huidigeVoldoende(value);
  const ces = cesuurPunten(Math.max(1, max), value);

  return (
    <div className="grid gap-5">
      <Choice
        value={value.model}
        onChange={(model) => onChange({ ...value, model })}
        options={MODELS}
      />

      {value.model !== "lineair" && stand ? (
        <Choice
          legend="Halen van een 5,5"
          value={stand}
          onChange={(id) => onChange(applyVoldoende(value.model, id))}
          options={STANDEN}
        />
      ) : null}

      {value.model === "gebroken" ? (
        <label className="grid gap-2">
          <span className="text-sm font-medium">
            Voldoende (5,5) bij {Math.round(value.cesuurPct)}% van de punten
          </span>
          <input
            type="range"
            min={35}
            max={75}
            step={1}
            value={value.cesuurPct}
            onChange={(e) =>
              onChange({
                ...value,
                model: "gebroken",
                cesuurPct: Number(e.target.value),
              })
            }
            className="accent-primary"
          />
          <span className="flex justify-between text-sm text-muted">
            <span>Makkelijker</span>
            <span>Moeilijker</span>
          </span>
        </label>
      ) : null}

      {value.model === "exponentieel" ? (
        <label className="grid gap-2">
          <span className="text-sm font-medium">
            Kromming k = {value.exponent.toFixed(2)}
          </span>
          <input
            type="range"
            min={0.5}
            max={1.8}
            step={0.05}
            value={value.exponent}
            onChange={(e) =>
              onChange({
                ...value,
                model: "exponentieel",
                exponent: Number(e.target.value),
              })
            }
            className="accent-primary"
          />
          <span className="flex justify-between text-sm text-muted">
            <span>Makkelijker</span>
            <span>Moeilijker</span>
          </span>
        </label>
      ) : null}

      <p className="text-sm text-muted">{voldoendeHint(value)}</p>
      <p className="text-sm">
        {modelLabel(value.model)} · 5,5 bij{" "}
        <span className="tabular-nums font-medium">{ces}</span> van {max} punten
      </p>

      {showCurve ? (
        <div className="min-w-0 rounded-[var(--radius-md)] bg-paper p-4">
          <CijferCurve max={max} norm={value} height={168} />
        </div>
      ) : null}
    </div>
  );
}
