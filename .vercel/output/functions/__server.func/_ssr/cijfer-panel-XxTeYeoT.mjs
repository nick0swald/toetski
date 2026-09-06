import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as Button, o as cn } from "./app-shell-BwgW9Zae.mjs";
import { a as cesuurZin, c as formuleTekst, f as nlCijfer, o as cijferVanScore, p as omzetTabel } from "./cijfer-CM0wPsdC.mjs";
import { i as fieldClassName, n as Input, r as Label } from "./choice-DWGYfizw.mjs";
import { n as CijferNormControls, t as CijferCurve } from "./cijfer-norm-controls-C4qlrG2B.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/cijfer-panel-XxTeYeoT.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function CijferPanel({ max, norm, onChange, maxEditable = false, onMaxChange, onExport, titel = "Cijfer berekenen" }) {
	const safeMax = Math.max(1, Math.round(max) || 1);
	const [score, setScore] = (0, import_react.useState)(Math.round(safeMax * .6));
	const clampedScore = Math.max(0, Math.min(safeMax, score));
	const tabel = (0, import_react.useMemo)(() => omzetTabel(safeMax, norm), [safeMax, norm]);
	const cijfer = cijferVanScore(clampedScore, safeMax, norm);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-8",
		children: [
			titel ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-2xl font-bold tracking-tight text-brand",
				children: titel
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-muted",
				children: "Zet punten om naar een cijfer van 1,0 tot 10,0. De tabel kun je als Word bewaren."
			})] }) : null,
			maxEditable ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-2 sm:max-w-xs",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					htmlFor: "max-punten",
					children: "Maximumscore"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					id: "max-punten",
					type: "number",
					min: 1,
					max: 200,
					value: safeMax,
					onChange: (e) => {
						const next = Math.max(1, Math.min(200, Number(e.target.value) || 1));
						onMaxChange?.(next);
						setScore((s) => Math.min(s, next));
					}
				})]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CijferNormControls, {
				value: norm,
				onChange,
				max: safeMax,
				showCurve: false
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm font-medium",
				children: formuleTekst(norm, safeMax)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm font-medium",
				children: cesuurZin(safeMax, norm)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
				htmlFor: "score",
				children: "Behaalde punten"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2 flex flex-wrap items-end gap-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						id: "score",
						type: "range",
						min: 0,
						max: safeMax,
						value: clampedScore,
						onChange: (e) => setScore(Number(e.target.value)),
						className: "min-w-40 flex-1 accent-primary"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "number",
						min: 0,
						max: safeMax,
						value: clampedScore,
						onChange: (e) => setScore(Number(e.target.value)),
						className: cn(fieldClassName, "w-20 tabular-nums")
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display text-4xl tabular-nums tracking-tight text-brand",
						children: nlCijfer(cijfer)
					})
				]
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "rounded-[var(--radius-md)] bg-paper p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CijferCurve, {
					max: safeMax,
					norm,
					score: clampedScore,
					height: 200
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "overflow-x-auto rounded-[var(--radius-md)] bg-paper p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "w-full min-w-[16rem] text-left text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: "border-b border-border",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "py-2 pr-3 font-medium",
							children: "Punten"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "py-2 font-medium",
							children: "Cijfer"
						})]
					}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: tabel.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: r.punten === clampedScore ? "bg-primary/10" : "border-b border-border",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "py-1.5 pr-3 tabular-nums",
							children: r.punten
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "py-1.5 tabular-nums",
							children: nlCijfer(r.cijfer)
						})]
					}, r.punten)) })]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				type: "button",
				onClick: () => void onExport(),
				children: "Omzettingstabel als Word"
			})
		]
	});
}
//#endregion
export { CijferPanel };
