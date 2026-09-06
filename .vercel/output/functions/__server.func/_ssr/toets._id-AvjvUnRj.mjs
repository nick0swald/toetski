import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime, v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { n as Button, o as cn, r as LeafMark, t as AppShell } from "./app-shell-BwgW9Zae.mjs";
import { a as cesuurZin, c as formuleTekst, o as cijferVanScore } from "./cijfer-CM0wPsdC.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { i as RTTI_ORDER, r as RTTI_META, s as SCHOOL } from "./constants-C-iIXaRj.mjs";
import { o as totaalPunten, t as afwijking } from "./rtti-B_X4rMyX.mjs";
import { t as withDefaults } from "./defaults-gTpbcpJZ.mjs";
import { a as maakVoorbeeldToets, i as maakVoorbeeldNaskToets, o as useToetsStore } from "./toets-store-ieR5MTKz.mjs";
import { a as FileDown, r as LoaderCircle } from "../_libs/lucide-react.mjs";
import { n as Route } from "./router-DKVXuoYy.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/toets._id-AvjvUnRj.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var label = {
	voldoet: "Voldoet",
	aandacht: "Aandacht",
	ontbreekt: "Ontbreekt"
};
function KwaliteitPanel({ toets }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-pretty leading-relaxed text-fg",
				children: toets.kwaliteit.samenvatting
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: toets.kwaliteit.punten.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "border-t border-border py-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-baseline justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "font-semibold text-brand",
						children: p.criterium
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: cn("text-sm", p.oordeel === "voldoet" ? "text-brand font-semibold" : "text-warn font-semibold"),
						children: label[p.oordeel]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1.5 text-sm leading-relaxed text-muted",
					children: p.toelichting
				})]
			}, p.criterium)) }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm leading-relaxed text-muted",
				children: "Dit is een constructiehulp. De vakdocent blijft verantwoordelijk voor inhoud, cesuur en afname. Loop de toets altijd na voordat leerlingen hem maken."
			})
		]
	});
}
var barColor = {
	R: "bg-rtti-r",
	T1: "bg-rtti-t1",
	T2: "bg-rtti-t2",
	I: "bg-rtti-i"
};
function RttiBars({ actual, doel }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "grid gap-3",
		children: RTTI_ORDER.map((k) => {
			const status = afwijking(actual[k], doel[k]);
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-baseline justify-between gap-3 text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "font-medium text-fg",
						children: [RTTI_META[k].kort, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ml-2 font-normal text-muted",
							children: RTTI_META[k].naam
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: cn("tabular-nums text-xs", status === "ok" ? "text-leaf" : "text-warn"),
						children: [
							actual[k],
							"% · doel ",
							doel[k],
							"%"
						]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative h-2 overflow-hidden rounded-full bg-border/70",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: cn("absolute inset-y-0 left-0 rounded-full", barColor[k]),
						style: { width: `${Math.min(100, actual[k])}%` }
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "absolute top-0 h-full w-px bg-ink/50",
						style: { left: `${doel[k]}%` },
						"aria-hidden": true
					})]
				})]
			}, k);
		})
	});
}
function MatrijsSheet({ toets }) {
	const { matrijs } = toets;
	const max = totaalPunten(toets.vragen);
	const actual = {
		R: matrijs.totalen.R.percentage,
		T1: matrijs.totalen.T1.percentage,
		T2: matrijs.totalen.T2.percentage,
		I: matrijs.totalen.I.percentage
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "cito-doc mx-auto w-full max-w-[210mm] bg-paper px-6 py-8 text-ink shadow-[var(--shadow-sheet)] sm:px-10 sm:py-10 print:max-w-none print:px-0 print:py-0 print:shadow-none",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "border-b-2 border-primary pb-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2 text-brand",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LeafMark, { className: "size-7" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display text-lg leading-tight",
							children: SCHOOL
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[11px] uppercase tracking-[0.18em] text-muted",
							children: "Toetsmatrijs · RTTI"
						})] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "mt-4 font-display text-2xl tracking-tight",
						children: toets.meta.titel
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-2 text-sm text-muted",
						children: [
							toets.meta.vak,
							" · ",
							toets.meta.leerweg,
							" klas ",
							toets.meta.leerjaar,
							" · ",
							max,
							" punten"
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-xs font-semibold uppercase tracking-[0.16em] text-muted",
					children: "Puntenverdeling versus doel"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-4",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RttiBars, {
						actual,
						doel: matrijs.doelverdeling
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
				className: "mt-8 overflow-x-auto",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "w-full min-w-[32rem] border-collapse text-sm",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-b-2 border-primary text-left",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "py-2 pr-3 font-semibold",
									children: "Domein / leerdoelcluster"
								}),
								RTTI_ORDER.map((k) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-2 py-2 font-semibold",
									children: RTTI_META[k].kort
								}, k)),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-2 py-2 font-semibold",
									children: "Totaal"
								})
							]
						}) }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: matrijs.domeinen.map((d) => {
							const row = matrijs.cellen[d];
							const rowTotal = RTTI_ORDER.reduce((s, k) => s + (row?.[k]?.punten ?? 0), 0);
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
								className: "border-b border-border align-top",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "py-2.5 pr-3 font-medium",
										children: d
									}),
									RTTI_ORDER.map((k) => {
										const cel = row?.[k];
										return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-2 py-2.5 tabular-nums",
											children: cel && cel.punten > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-muted",
												children: cel.vraagnummers.map((n) => `v${n}`).join(" ")
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "mt-0.5 block font-medium",
												children: [cel.punten, "p"]
											})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-border",
												children: "—"
											})
										}, k);
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
										className: "px-2 py-2.5 tabular-nums font-medium",
										children: [rowTotal, "p"]
									})
								]
							}, d);
						}) }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tfoot", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-t-2 border-primary font-semibold",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2.5 pr-3",
									children: "Totaal"
								}),
								RTTI_ORDER.map((k) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
									className: "px-2 py-2.5 tabular-nums",
									children: [
										matrijs.totalen[k].punten,
										"p",
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "ml-1 font-normal text-muted",
											children: [matrijs.totalen[k].percentage, "%"]
										})
									]
								}, k)),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
									className: "px-2 py-2.5 tabular-nums",
									children: [max, "p"]
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "text-muted",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 pr-3 font-medium",
									children: "Doel"
								}),
								RTTI_ORDER.map((k) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
									className: "px-2 py-2 tabular-nums",
									children: [matrijs.doelverdeling[k], "%"]
								}, k)),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-2 py-2",
									children: "100%"
								})
							]
						})] })
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-8",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-xs font-semibold uppercase tracking-[0.16em] text-muted",
					children: "Vragen per leerdoel"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-3 space-y-2 text-sm",
					children: toets.vragen.map((q) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "w-8 shrink-0 tabular-nums text-muted",
							children: ["v", q.nummer]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-medium",
							children: q.leerdoel
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "mt-0.5 block text-xs text-muted",
							children: [
								q.domein,
								" · ",
								q.punten,
								"p · ",
								RTTI_META[q.rtti].naam
							]
						})] })]
					}, q.nummer))
				})]
			})
		]
	});
}
var badgeVariants = cva("inline-flex items-center rounded-[var(--radius-sm)] px-2 py-0.5 text-xs font-medium tracking-wide", {
	variants: { variant: {
		default: "bg-primary/20 text-brand",
		muted: "bg-border/60 text-muted",
		r: "bg-rtti-r/15 text-rtti-r",
		t1: "bg-rtti-t1/20 text-brand",
		t2: "bg-rtti-t2/35 text-ink",
		i: "bg-rtti-i/15 text-rtti-i",
		ok: "bg-leaf/20 text-brand",
		warn: "bg-warn/15 text-warn"
	} },
	defaultVariants: { variant: "default" }
});
function Badge({ className, variant, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn(badgeVariants({ variant }), className),
		...props
	});
}
var variant = {
	R: "r",
	T1: "t1",
	T2: "t2",
	I: "i"
};
function RttiBadge({ rtti, withName = false }) {
	const meta = RTTI_META[rtti];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		variant: variant[rtti],
		title: meta.uitleg,
		children: withName ? `${meta.kort} · ${meta.naam}` : meta.kort
	});
}
function NakijkSheet({ toets, editing, onAntwoord }) {
	const t = withDefaults(toets);
	const max = totaalPunten(t.vragen);
	const scores = [
		0,
		.4,
		.55,
		.7,
		.85,
		1
	].map((f) => {
		const p = Math.round(f * max);
		return {
			p,
			cijfer: cijferVanScore(p, max, t.cijferNorm)
		};
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "cito-doc mx-auto w-full max-w-[210mm] bg-paper px-6 py-8 text-ink shadow-[var(--shadow-sheet)] sm:px-10 sm:py-10 print:max-w-none print:px-0 print:py-0 print:shadow-none",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "border-b-2 border-primary pb-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2 text-brand",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LeafMark, { className: "size-7" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display text-lg leading-tight",
							children: SCHOOL
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[11px] uppercase tracking-[0.18em] text-muted",
							children: "Correctievoorschrift · niet voor leerlingen"
						})] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
						className: "mt-4 font-display text-2xl tracking-tight",
						children: ["Nakijkmodel · ", t.meta.titel]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-2 text-sm text-muted",
						children: [
							t.meta.vak,
							" · ",
							t.meta.leerweg,
							" klas ",
							t.meta.leerjaar,
							" · versie ",
							t.meta.versie,
							" · max ",
							max,
							" punten"
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-5 rounded-[var(--radius-md)] border border-border bg-bg/50 px-4 py-3 text-sm",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-medium",
						children: formuleTekst(t.cijferNorm, max)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 font-medium",
						children: cesuurZin(max, t.cijferNorm)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums text-muted",
						children: scores.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
							s.p,
							"p → ",
							s.cijfer.toFixed(1)
						] }, s.p))
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
				className: "mt-8 space-y-7",
				children: t.nakijkmodel.map((n) => {
					const q = t.vragen.find((v) => v.nummer === n.nummer);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "break-inside-avoid",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap items-center gap-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
										className: "font-semibold",
										children: [
											"Vraag ",
											n.nummer,
											" ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "font-normal text-muted",
												children: [
													"(",
													q?.punten ?? "?",
													"p)"
												]
											})
										]
									}),
									q ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RttiBadge, { rtti: q.rtti }) : null,
									q ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-xs text-muted",
										children: q.domein
									}) : null
								]
							}),
							editing && onAntwoord ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
								value: n.modelantwoord,
								onChange: (e) => onAntwoord(n.nummer, e.target.value),
								className: "mt-2 min-h-20 w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 text-sm"
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 whitespace-pre-wrap text-sm leading-relaxed",
								children: n.modelantwoord
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
								className: "mt-2 space-y-1 text-sm",
								children: n.puntenverdeling.map((p, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "flex gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "w-8 shrink-0 tabular-nums font-medium text-brand",
										children: [p.punt, "p"]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: p.criterium })]
								}, `${n.nummer}-${i}`))
							}),
							n.nietToekennen?.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-2 text-sm text-muted",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-medium text-fg",
									children: "Niet toekennen: "
								}), n.nietToekennen.join(" · ")]
							}) : null
						]
					}, n.nummer);
				})
			})
		]
	});
}
function BronTabel({ tabel }) {
	if (!tabel.koppen.length) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "mt-3 overflow-x-auto rounded-[var(--radius-sm)] border border-border bg-bg/60",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
			className: "w-full min-w-[12rem] text-left text-sm",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
				className: "border-b border-border",
				children: tabel.koppen.map((k) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
					className: "px-3 py-2 font-semibold text-brand",
					children: k
				}, k))
			}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: tabel.rijen.map((rij, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
				className: "border-b border-border last:border-b-0",
				children: rij.map((cel, j) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
					className: "px-3 py-1.5 tabular-nums",
					children: cel
				}, j))
			}, i)) })]
		})
	});
}
function BronGrafiek({ grafiek }) {
	const pts = grafiek.punten;
	if (pts.length < 2) return null;
	const W = 320;
	const H = 180;
	const pad = {
		l: 40,
		r: 12,
		t: 18,
		b: 32
	};
	const xs = pts.map((p) => p.x);
	const ys = pts.map((p) => p.y);
	const minX = Math.min(...xs);
	const maxX = Math.max(...xs);
	const minY = Math.min(0, ...ys);
	const maxY = Math.max(...ys);
	const spanX = maxX - minX || 1;
	const spanY = maxY - minY || 1;
	const xOf = (x) => pad.l + (x - minX) / spanX * (W - pad.l - pad.r);
	const yOf = (y) => pad.t + (1 - (y - minY) / spanY) * (H - pad.t - pad.b);
	const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${xOf(p.x).toFixed(1)} ${yOf(p.y).toFixed(1)}`).join(" ");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("figure", {
		className: "mt-3 rounded-[var(--radius-sm)] border border-border bg-bg/60 p-3",
		children: [grafiek.titel ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("figcaption", {
			className: "mb-1 text-sm font-semibold text-brand",
			children: grafiek.titel
		}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
			viewBox: `0 0 ${W} ${H}`,
			className: "w-full max-w-md",
			role: "img",
			"aria-label": grafiek.titel || "Grafiek",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
					x1: pad.l,
					y1: pad.t,
					x2: pad.l,
					y2: H - pad.b,
					stroke: "currentColor",
					className: "text-border"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
					x1: pad.l,
					y1: H - pad.b,
					x2: W - pad.r,
					y2: H - pad.b,
					stroke: "currentColor",
					className: "text-border"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
					d,
					fill: "none",
					stroke: "var(--color-primary)",
					strokeWidth: "2.2",
					strokeLinejoin: "round",
					strokeLinecap: "round"
				}),
				pts.map((p, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
					cx: xOf(p.x),
					cy: yOf(p.y),
					r: "3.2",
					fill: "var(--color-brand)"
				}, i)),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
					x: W / 2,
					y: 174,
					textAnchor: "middle",
					className: "fill-muted",
					fontSize: "10",
					children: grafiek.xLabel
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
					x: 12,
					y: H / 2,
					textAnchor: "middle",
					className: "fill-muted",
					fontSize: "10",
					transform: `rotate(-90 12 ${H / 2})`,
					children: grafiek.yLabel
				})
			]
		})]
	});
}
function Field({ label }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-8 items-end gap-2 border-b border-dotted border-ink/30 pb-0.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "shrink-0 text-[11px] uppercase tracking-wider text-muted",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "flex-1" })]
	});
}
function ToetsSheet({ toets, editing, onStam }) {
	const m = toets.meta;
	const max = totaalPunten(toets.vragen);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "cito-doc mx-auto w-full max-w-[210mm] bg-paper px-6 py-8 text-ink shadow-[var(--shadow-sheet)] sm:px-10 sm:py-10 print:max-w-none print:px-0 print:py-0 print:shadow-none",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "border-b-2 border-primary pb-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-start justify-between gap-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2 text-brand",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LeafMark, { className: "size-7" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-display text-lg leading-tight tracking-tight",
								children: SCHOOL
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[11px] uppercase tracking-[0.18em] text-muted",
								children: "Schooltoets"
							})] })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-right text-sm text-muted",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
								m.vak,
								" · ",
								m.leerweg,
								" · versie ",
								m.versie
							] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
								"klas ",
								m.leerjaar,
								" · ",
								m.moeilijkheid
							] })]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "mt-4 font-display text-2xl tracking-tight text-balance",
						children: m.titel
					}),
					m.onderwerp && m.onderwerp !== m.titel ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-muted",
						children: m.onderwerp
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-3 text-sm",
						children: [
							"Tijd: ",
							m.duurMinuten,
							" minuten",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mx-2 text-border",
								children: "·"
							}),
							"Maximumscore: ",
							max,
							" punten",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mx-2 text-border",
								children: "·"
							}),
							toets.vragen.length,
							" vragen"
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-5 grid gap-3 sm:grid-cols-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, { label: "Naam" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, { label: "Klas" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, { label: "Datum" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, { label: "Docent" })
				]
			}),
			m.hulpmiddelen.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-5 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-semibold",
					children: "Hulpmiddelen: "
				}), m.hulpmiddelen.join(" · ")]
			}) : null,
			m.instructies.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-xs font-semibold uppercase tracking-[0.16em] text-muted",
					children: "Instructie"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-2 list-disc space-y-1 pl-5 text-sm leading-snug",
					children: m.instructies.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: s }, s))
				})]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
				className: "mt-8 space-y-8",
				children: toets.vragen.map((q) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "break-inside-avoid",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-start justify-between gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
								className: "font-semibold",
								children: [
									q.nummer,
									" ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "font-normal text-muted",
										children: [
											"(",
											q.punten,
											"p)"
										]
									})
								]
							}), editing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "print:hidden",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RttiBadge, { rtti: q.rtti })
							}) : null]
						}),
						q.context ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-2 rounded-[var(--radius-sm)] border border-border bg-bg/60 px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
							children: q.context
						}) : null,
						editing && onStam ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
							value: q.stam,
							onChange: (e) => onStam(q.nummer, e.target.value),
							className: "mt-2 min-h-24 w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 text-sm leading-relaxed"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 whitespace-pre-wrap leading-relaxed",
							children: q.stam
						}),
						q.tabel ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BronTabel, { tabel: q.tabel }) : null,
						q.grafiek ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BronGrafiek, { grafiek: q.grafiek }) : null,
						q.opties?.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "mt-3 space-y-1.5",
							children: q.opties.map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex gap-3 text-sm",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "flex size-6 shrink-0 items-center justify-center rounded-full border border-ink/30 text-xs font-medium",
									children: o.letter
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "pt-0.5",
									children: o.tekst
								})]
							}, o.letter))
						}) : q.type !== "meerkeuze" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: cn("mt-3 border-t border-dotted border-ink/25", q.punten >= 3 ? "h-24" : "h-14"),
							"aria-hidden": true
						}) : null
					]
				}, q.nummer))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
				className: "mt-10 border-t border-border pt-3 text-[11px] text-muted print:mt-6",
				children: [
					SCHOOL,
					" · niet verspreiden buiten de afname · blad 1/",
					Math.max(1, Math.ceil(toets.vragen.length / 6))
				]
			})
		]
	});
}
var TABS = [
	{
		id: "toets",
		label: "Toets"
	},
	{
		id: "nakijk",
		label: "Nakijkmodel"
	},
	{
		id: "matrijs",
		label: "Toetsmatrijs"
	},
	{
		id: "cijfer",
		label: "Cijfer"
	},
	{
		id: "kwaliteit",
		label: "Kwaliteit"
	}
];
var CijferPanel = (0, import_react.lazy)(() => import("./cijfer-panel-XxTeYeoT.mjs").then((m) => ({ default: m.CijferPanel })));
function useHydrated() {
	const [hydrated, setHydrated] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		const unsub = useToetsStore.persist.onFinishHydration(() => setHydrated(true));
		if (useToetsStore.persist.hasHydrated()) setHydrated(true);
		return unsub;
	}, []);
	return hydrated;
}
function ToetsPage() {
	const { id } = Route.useParams();
	const hydrated = useHydrated();
	const stored = useToetsStore((s) => s.toetsen.find((t) => t.id === id));
	const raw = stored ?? (id === "voorbeeld-fotosynthese" ? maakVoorbeeldToets() : id === "voorbeeld-nask-kas" ? maakVoorbeeldNaskToets() : void 0);
	const toets = raw ? withDefaults(raw) : void 0;
	const updateVraag = useToetsStore((s) => s.updateVraag);
	const updateNakijk = useToetsStore((s) => s.updateNakijk);
	const update = useToetsStore((s) => s.update);
	const [tab, setTab] = (0, import_react.useState)("toets");
	const [editing, setEditing] = (0, import_react.useState)(false);
	const [saving, setSaving] = (0, import_react.useState)(false);
	const ensureVoorbeeld = useToetsStore((s) => s.ensureVoorbeeld);
	const ensureVoorbeeldNask = useToetsStore((s) => s.ensureVoorbeeldNask);
	(0, import_react.useEffect)(() => {
		if (id === "voorbeeld-fotosynthese" && !stored) ensureVoorbeeld();
		if (id === "voorbeeld-nask-kas" && !stored) ensureVoorbeeldNask();
	}, [
		id,
		stored,
		ensureVoorbeeld,
		ensureVoorbeeldNask
	]);
	(0, import_react.useEffect)(() => {
		if (stored?.soort === "matrijs") setTab("matrijs");
	}, [id, stored?.soort]);
	const titel = toets?.meta.titel ?? "Toets";
	if (!hydrated) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "mx-auto max-w-3xl px-5 py-16 text-muted",
		children: "Toets laden…"
	}) });
	if (!toets) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto max-w-3xl px-5 py-16",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-2xl font-medium tracking-tight",
				children: "Toets niet gevonden"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-sm text-muted",
				children: "Hij staat niet (meer) op dit apparaat. Maak een nieuwe, of open het voorbeeld vanaf de startpagina."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				asChild: true,
				className: "mt-6",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/",
					children: "Nieuwe toets"
				})
			})
		]
	}) });
	const current = toets;
	const isMatrijs = toets.soort === "matrijs";
	const heeftFeedback = Boolean(toets.feedbackGewenst) || toets.kwaliteit.punten.length > 0;
	const tabs = TABS.filter((t) => {
		if (isMatrijs && (t.id === "toets" || t.id === "cijfer" || t.id === "nakijk")) return false;
		if (t.id === "nakijk" && toets.nakijkmodel.length === 0) return false;
		if (t.id === "kwaliteit" && isMatrijs && !heeftFeedback) return false;
		return true;
	});
	const visibleTab = tabs.some((t) => t.id === tab) ? tab : tabs[0]?.id ?? "toets";
	async function saveDocx() {
		setSaving(true);
		try {
			const { downloadMatrijsDocx, downloadPakketDocx } = await import("./docx-export-BI__qTTL.mjs");
			if (current.soort === "matrijs") await downloadMatrijsDocx(current);
			else await downloadPakketDocx(current);
			toast.success("Word-bestand gedownload");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Download mislukt");
		} finally {
			setSaving(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, {
		printHidden: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "print:hidden",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mx-auto max-w-3xl px-5 pt-8 sm:px-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/",
						className: "text-sm text-muted hover:text-fg",
						children: "Overzicht"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
								className: "truncate text-2xl font-bold tracking-tight text-brand",
								children: titel
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-sm text-muted",
								children: isMatrijs ? `Matrijs · ${toets.meta.vak} · ${toets.meta.leerweg} klas ${toets.meta.leerjaar}${heeftFeedback ? " · met feedback" : ""}` : `${toets.meta.vak} · ${toets.meta.leerweg} klas ${toets.meta.leerjaar} · versie ${toets.meta.versie} · ${toets.meta.moeilijkheid}`
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap gap-2",
							children: [isMatrijs ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "button",
								variant: editing ? "default" : "ghost",
								onClick: () => setEditing((v) => !v),
								children: editing ? "Klaar" : "Bewerken"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								type: "button",
								disabled: saving,
								onClick: saveDocx,
								variant: "ink",
								children: [saving ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileDown, { className: "size-4" }), "Word"]
							})]
						})]
					}),
					tabs.length > 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
						className: "mt-6 flex gap-1 overflow-x-auto rounded-[var(--radius-lg)] bg-surface p-1",
						children: tabs.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setTab(t.id),
							className: cn("min-h-11 shrink-0 rounded-[var(--radius-md)] px-3 text-sm whitespace-nowrap", visibleTab === t.id ? "bg-brand font-semibold text-paper" : "text-muted hover:text-brand"),
							children: t.id === "kwaliteit" && isMatrijs ? "Feedback" : t.label
						}, t.id))
					}) : null
				]
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto max-w-[210mm] px-3 py-8 sm:px-6",
			children: [
				visibleTab === "toets" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToetsSheet, {
					toets,
					editing,
					onStam: (nummer, stam) => updateVraag(toets.id, nummer, { stam })
				}) : null,
				visibleTab === "nakijk" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NakijkSheet, {
					toets,
					editing,
					onAntwoord: (nummer, modelantwoord) => updateNakijk(toets.id, nummer, { modelantwoord })
				}) : null,
				visibleTab === "matrijs" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MatrijsSheet, { toets }) : null,
				visibleTab === "cijfer" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mx-auto max-w-2xl rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react.Suspense, {
						fallback: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-muted",
							children: "Cijfermodule laden…"
						}),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CijferPanel, {
							max: totaalPunten(toets.vragen),
							norm: toets.cijferNorm,
							onChange: (norm) => {
								update(toets.id, { cijferNorm: norm });
							},
							onExport: async () => {
								const { downloadCijferDocx } = await import("./docx-export-BI__qTTL.mjs");
								await downloadCijferDocx(toets);
								toast.success("Word-bestand gedownload");
							}
						})
					})
				}) : null,
				visibleTab === "kwaliteit" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto max-w-2xl rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-2xl font-bold tracking-tight text-brand",
							children: isMatrijs ? "Feedback op deze toets" : "SLO-kwaliteitscheck"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 leading-relaxed text-muted",
							children: isMatrijs ? "Beoordeling van de bestaande toets. Jouw vakoordeel gaat hier boven." : "Automatische beoordeling bij constructie. Jouw vakoordeel gaat hier boven."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-6",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(KwaliteitPanel, { toets })
						})
					]
				}) : null
			]
		})]
	});
}
//#endregion
export { ToetsPage as component };
