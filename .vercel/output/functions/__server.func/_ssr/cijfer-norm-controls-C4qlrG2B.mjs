import { S as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { d as modelLabel, f as nlCijfer, i as cesuurPunten, l as huidigeVoldoende, m as voldoendeHint, n as applyVoldoende, o as cijferVanScore, s as curvePunten } from "./cijfer-CM0wPsdC.mjs";
import { t as Choice } from "./choice-DWGYfizw.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/cijfer-norm-controls-C4qlrG2B.js
var import_jsx_runtime = require_jsx_runtime();
function pathFromPoints(pts, smooth) {
	if (pts.length === 0) return "";
	const fmt = (n) => n.toFixed(2);
	if (!smooth || pts.length < 4) return pts.map((pt, i) => `${i === 0 ? "M" : "L"} ${fmt(pt.x)} ${fmt(pt.y)}`).join(" ");
	let d = `M ${fmt(pts[0].x)} ${fmt(pts[0].y)}`;
	for (let i = 0; i < pts.length - 1; i++) {
		const p0 = pts[i - 1] ?? pts[i];
		const p1 = pts[i];
		const p2 = pts[i + 1];
		const p3 = pts[i + 2] ?? p2;
		const c1x = p1.x + (p2.x - p0.x) / 6;
		const c1y = p1.y + (p2.y - p0.y) / 6;
		const c2x = p2.x - (p3.x - p1.x) / 6;
		const c2y = p2.y - (p3.y - p1.y) / 6;
		d += ` C ${fmt(c1x)} ${fmt(c1y)}, ${fmt(c2x)} ${fmt(c2y)}, ${fmt(p2.x)} ${fmt(p2.y)}`;
	}
	return d;
}
function CijferCurve({ max, norm, score, height = 180 }) {
	const W = 360;
	const H = 180;
	const pad = {
		l: 32,
		r: 10,
		t: 14,
		b: 26
	};
	const innerW = W - pad.l - pad.r;
	const innerH = H - pad.t - pad.b;
	const safeMax = Math.max(1, max);
	const pts = curvePunten(safeMax, norm);
	const xOf = (p) => pad.l + p / safeMax * innerW;
	const yOf = (c) => pad.t + (1 - (c - 1) / 9) * innerH;
	const d = pathFromPoints(pts.map((pt) => ({
		x: xOf(pt.p),
		y: yOf(pt.cijfer)
	})), norm.model === "exponentieel");
	const ces = cesuurPunten(safeMax, norm);
	const cesX = xOf(ces);
	const scoreC = score == null ? null : cijferVanScore(score, safeMax, norm);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		viewBox: `0 0 ${W} ${H}`,
		className: "w-full min-w-0 max-w-full",
		style: { height },
		role: "img",
		"aria-label": `Cijfercurve ${norm.model}, 5,5 bij ${ces} van ${safeMax} punten`,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("title", { children: `Cijfercurve: 0p = 1,0 · ${ces}p = 5,5 · ${safeMax}p = 10,0` }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
				x1: pad.l,
				y1: pad.t,
				x2: pad.l,
				y2: pad.t + innerH,
				stroke: "currentColor",
				className: "text-border"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
				x1: pad.l,
				y1: pad.t + innerH,
				x2: pad.l + innerW,
				y2: pad.t + innerH,
				stroke: "currentColor",
				className: "text-border"
			}),
			[
				1,
				5.5,
				10
			].map((tick) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
				x1: pad.l - 3,
				y1: yOf(tick),
				x2: pad.l + innerW,
				y2: yOf(tick),
				stroke: "currentColor",
				strokeDasharray: tick === 5.5 ? "4 4" : void 0,
				className: tick === 5.5 ? "text-primary/40" : "text-border"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
				x: pad.l - 6,
				y: yOf(tick) + 3,
				textAnchor: "end",
				className: "fill-muted",
				fontSize: "10",
				children: nlCijfer(tick)
			})] }, tick)),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
				x1: cesX,
				y1: pad.t,
				x2: cesX,
				y2: pad.t + innerH,
				stroke: "currentColor",
				strokeDasharray: "4 4",
				className: "text-primary/50"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				d,
				fill: "none",
				stroke: "var(--color-primary)",
				strokeWidth: "2.6",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				vectorEffect: "non-scaling-stroke"
			}),
			scoreC != null && score != null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: xOf(score),
				cy: yOf(scoreC),
				r: "5",
				fill: "var(--color-primary)"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
				x: Math.min(xOf(score) + 8, pad.l + innerW - 4),
				y: yOf(scoreC) - 8,
				className: "fill-brand",
				fontSize: "11",
				fontWeight: "600",
				children: nlCijfer(scoreC)
			})] }) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
				x: pad.l,
				y: 174,
				className: "fill-muted",
				fontSize: "10",
				children: "0p"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("text", {
				x: cesX,
				y: 174,
				textAnchor: "middle",
				className: "fill-brand",
				fontSize: "10",
				children: [ces, "p → 5,5"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("text", {
				x: pad.l + innerW,
				y: 174,
				textAnchor: "end",
				className: "fill-muted",
				fontSize: "10",
				children: [safeMax, "p"]
			})
		]
	});
}
var MODELS = [
	{
		id: "lineair",
		label: "Lineair",
		hint: "1,0–10,0, elk punt telt even zwaar"
	},
	{
		id: "gebroken",
		label: "Gebroken",
		hint: "Knikpunt bij de 5,5"
	},
	{
		id: "exponentieel",
		label: "Exponentieel",
		hint: "Kromme: midden zwaarder of lichter"
	}
];
var STANDEN = [
	{
		id: "makkelijker",
		label: "Makkelijker"
	},
	{
		id: "normaal",
		label: "Normaal"
	},
	{
		id: "moeilijker",
		label: "Moeilijker"
	}
];
function CijferNormControls({ value, onChange, max, showCurve = true }) {
	const stand = huidigeVoldoende(value);
	const ces = cesuurPunten(Math.max(1, max), value);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Choice, {
				value: value.model,
				onChange: (model) => onChange({
					...value,
					model
				}),
				options: MODELS
			}),
			value.model !== "lineair" && stand ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Choice, {
				legend: "Halen van een 5,5",
				value: stand,
				onChange: (id) => onChange(applyVoldoende(value.model, id)),
				options: STANDEN
			}) : null,
			value.model === "gebroken" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "grid gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-sm font-medium",
						children: [
							"Voldoende (5,5) bij ",
							Math.round(value.cesuurPct),
							"% van de punten"
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "range",
						min: 35,
						max: 75,
						step: 1,
						value: value.cesuurPct,
						onChange: (e) => onChange({
							...value,
							model: "gebroken",
							cesuurPct: Number(e.target.value)
						}),
						className: "accent-primary"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "flex justify-between text-sm text-muted",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Makkelijker" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Moeilijker" })]
					})
				]
			}) : null,
			value.model === "exponentieel" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "grid gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-sm font-medium",
						children: ["Kromming k = ", value.exponent.toFixed(2)]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "range",
						min: .5,
						max: 1.8,
						step: .05,
						value: value.exponent,
						onChange: (e) => onChange({
							...value,
							model: "exponentieel",
							exponent: Number(e.target.value)
						}),
						className: "accent-primary"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "flex justify-between text-sm text-muted",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Makkelijker" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Moeilijker" })]
					})
				]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: voldoendeHint(value)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-sm",
				children: [
					modelLabel(value.model),
					" · 5,5 bij",
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "tabular-nums font-medium",
						children: ces
					}),
					" van ",
					max,
					" punten"
				]
			}),
			showCurve ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "min-w-0 rounded-[var(--radius-md)] bg-paper p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CijferCurve, {
					max,
					norm: value,
					height: 168
				})
			}) : null
		]
	});
}
//#endregion
export { CijferNormControls as n, CijferCurve as t };
