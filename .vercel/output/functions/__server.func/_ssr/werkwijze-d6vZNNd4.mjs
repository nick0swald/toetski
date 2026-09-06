import { S as require_jsx_runtime, v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as PageIntro, i as Page, n as Button, t as AppShell } from "./app-shell-BwgW9Zae.mjs";
import { a as RTTI_PRESETS, i as RTTI_ORDER, r as RTTI_META } from "./constants-C-iIXaRj.mjs";
import { s as ArrowRight } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/werkwijze-d6vZNNd4.js
var import_jsx_runtime = require_jsx_runtime();
var STAPPEN = [
	{
		n: "01",
		t: "Lesstof wordt toets",
		d: "Plak alleen de lesstof → check de bevestigingsregel → Toets maken. Daar ontstaat het leerlingblad, het nakijkmodel, de toetsmatrijs en de cijferomzetting."
	},
	{
		n: "02",
		t: "Kaders",
		d: "Wil je sturen: vakprofiel (Generiek of NaSk), niveau BB / KB / GT (HGL volgt GT), leerjaar, versie A/B, moeilijkheid, RTTI-balk en cijfernorm. Standaard is KB klas 2, versie A, normaal, lineair 1,0–10,0."
	},
	{
		n: "03",
		t: "Word-pakket",
		d: "Na Toets maken downloadt het Word-pakket vanzelf. Tik Word als de download wordt geblokkeerd. Jij blijft eigenaar: niets gaat automatisch het PTA in."
	},
	{
		n: "04",
		t: "Matrijsmaker",
		d: "Toets al klaar? Lever het bestand in, zet vak, leerjaar en doel-RTTI. Alleen de RTTI-matrijs als Word. Feedback is optioneel."
	}
];
function Werkwijze() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Page, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageIntro, {
			title: "Werkwijze",
			children: "Constructiehulp voor Aeres VMBO Leeuwarden. In 30 seconden: plak lesstof → check de bevestigingsregel → Toets maken → Word-pakket (leerlingblad + nakijkmodel + matrijs + cijfer). Jij stelt inhoud en cesuur vast."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
			className: "grid gap-4",
			children: STAPPEN.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-sm font-semibold tabular-nums text-muted",
						children: s.n
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "mt-2 text-2xl font-bold tracking-tight text-brand",
						children: s.t
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 leading-relaxed text-muted",
						children: s.d
					})
				]
			}, s.n))
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-4 rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-2xl font-bold tracking-tight text-brand",
					children: "RTTI"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 leading-relaxed text-muted",
					children: "Codering van Docentplus. Eén balk van 100%: R, T1, T2 en I. Kies makkelijk, normaal of moeilijk — of sleep de schotten zelf. De matrijs telt punten, niet het aantal vragen."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-6 grid gap-4 sm:grid-cols-2",
					children: RTTI_ORDER.map((k) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "rounded-[var(--radius-md)] bg-paper p-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "font-semibold text-brand",
							children: [
								RTTI_META[k].kort,
								" · ",
								RTTI_META[k].naam
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-sm leading-relaxed text-muted",
							children: RTTI_META[k].uitleg
						})]
					}, k))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-6 overflow-x-auto rounded-[var(--radius-md)] bg-paper p-4",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
						className: "w-full min-w-[20rem] text-left text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-b border-border",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "py-2 pr-3 font-semibold text-brand",
									children: "Preset"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-2 py-2 font-semibold text-brand",
									children: "R"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-2 py-2 font-semibold text-brand",
									children: "T1"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-2 py-2 font-semibold text-brand",
									children: "T2"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-2 py-2 font-semibold text-brand",
									children: "I"
								})
							]
						}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: Object.values(RTTI_PRESETS).map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-b border-border last:border-b-0",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 pr-3",
									children: p.label
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
									className: "px-2 py-2 tabular-nums",
									children: [p.verdeling.R, "%"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
									className: "px-2 py-2 tabular-nums",
									children: [p.verdeling.T1, "%"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
									className: "px-2 py-2 tabular-nums",
									children: [p.verdeling.T2, "%"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
									className: "px-2 py-2 tabular-nums",
									children: [p.verdeling.I, "%"]
								})
							]
						}, p.label)) })]
					})
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-4 rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-2xl font-bold tracking-tight text-brand",
				children: "Cijfernorm"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
				className: "mt-4 list-disc space-y-2 pl-5 leading-relaxed text-muted",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Lineair: elk punt telt even zwaar. Cijfer = 1 + 9 × (score/max). Een 5,5 ligt altijd op 50%." }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Gebroken grafiek: knik bij de 5,5. Schuif het knikpunt naar beneden (voldoende makkelijker) of omhoog (moeilijker)." }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Exponentieel: cijfer = 1 + 9 × (score/max)^k. k kleiner dan 1 maakt middelste scores hoger; k groter dan 1 maakt ze lager." }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Moeilijkheid van de toets (vragen) en van de cesuur (cijfer) zijn twee verschillende knoppen." })
				]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-4 rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-2xl font-bold tracking-tight text-brand",
				children: "SLO en Cito"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
				className: "mt-4 list-disc space-y-2 pl-5 leading-relaxed text-muted",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Validiteit: vragen dekken de ingevoerde leerdoelen." }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Betrouwbaarheid: nakijkmodel met verdeelsleutel, zodat twee collega’s tot dezelfde score komen." }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Transparantie: punten per vraag, instructie, en een cijfernorm." }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Taal: afgestemd op leerweg — BB korter en concreter dan GT." }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Opmaak: Cito-conventie (schreefloos, nummering, punten, A–D)." })
				]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-4 rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-2xl font-bold tracking-tight text-brand",
					children: "Delen met collega’s"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 leading-relaxed text-muted",
					children: "Deel de link van de app, niet je Grok-account. Opgeslagen werk blijft op het eigen apparaat. AI-gebruik gaat van de eigenaar van deze app."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 flex flex-wrap gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						asChild: true,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/",
							children: ["Naar de maker", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "size-4" })]
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						asChild: true,
						variant: "secondary",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/matrijsmaker",
							children: "Matrijsmaker"
						})
					})]
				})
			]
		})
	] }) });
}
//#endregion
export { Werkwijze as component };
