import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime, b as useNavigate, v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as Page, n as Button, o as cn, t as AppShell } from "./app-shell-BwgW9Zae.mjs";
import { r as bevestigingsRegel, t as DEFAULT_CIJFER } from "./cijfer-CM0wPsdC.mjs";
import { n as Input, r as Label, t as Choice } from "./choice-DWGYfizw.mjs";
import { n as CijferNormControls } from "./cijfer-norm-controls-C4qlrG2B.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { a as RTTI_PRESETS, c as VAKPROFIELEN, d as presetVoorLeerjaar, f as rttiVoorMoeilijkheid, i as RTTI_ORDER, l as VERSIES, n as MOEILIJKHEDEN, r as RTTI_META, t as LEERWEGEN } from "./constants-C-iIXaRj.mjs";
import { i as normaliseer } from "./rtti-B_X4rMyX.mjs";
import { t as withDefaults } from "./defaults-gTpbcpJZ.mjs";
import { i as leesBronBestand, r as generateToets, t as Textarea } from "./lees-bron-CulWuLbY.mjs";
import { n as VOORBEELD_NASK_LESSTOF, o as useToetsStore, t as VOORBEELD_LESSTOF } from "./toets-store-ieR5MTKz.mjs";
import { a as FileDown, i as FileUp, n as Trash2, o as ChevronDown, r as LoaderCircle, s as ArrowRight } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-I1vsP4YX.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var FILL = {
	R: "bg-rtti-r text-paper",
	T1: "bg-rtti-t1 text-primary-fg",
	T2: "bg-rtti-t2 text-ink",
	I: "bg-rtti-i text-paper"
};
function snap(n) {
	return Math.max(0, Math.min(100, Math.round(n / 5) * 5));
}
function RttiPicker({ value, onChange }) {
	const barRef = (0, import_react.useRef)(null);
	const drag = (0, import_react.useRef)(null);
	const v = normaliseer(value);
	const parts = RTTI_ORDER.map((k) => v[k]);
	const applyParts = (0, import_react.useCallback)((next) => {
		onChange({
			R: next[0],
			T1: next[1],
			T2: next[2],
			I: next[3]
		});
	}, [onChange]);
	function onPointerDown(index, e) {
		e.preventDefault();
		e.currentTarget.setPointerCapture(e.pointerId);
		drag.current = {
			index,
			startX: e.clientX,
			start: [...parts]
		};
	}
	function onPointerMove(e) {
		if (!drag.current || !barRef.current) return;
		const w = barRef.current.getBoundingClientRect().width;
		if (w <= 0) return;
		const i = drag.current.index;
		const start = drag.current.start;
		const pair = start[i] + start[i + 1];
		const delta = (e.clientX - drag.current.startX) / w * 100;
		let left = snap(start[i] + delta);
		left = Math.max(0, Math.min(pair, left));
		const next = [...start];
		next[i] = left;
		next[i + 1] = pair - left;
		applyParts(next);
	}
	function onPointerUp() {
		drag.current = null;
	}
	function nudge(index, dir) {
		const pair = parts[index] + parts[index + 1];
		let left = snap(parts[index] + dir * 5);
		left = Math.max(0, Math.min(pair, left));
		const next = [...parts];
		next[index] = left;
		next[index + 1] = pair - left;
		applyParts(next);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				ref: barRef,
				className: "relative flex h-12 w-full overflow-hidden rounded-[var(--radius-lg)] select-none touch-none",
				role: "group",
				"aria-label": "RTTI-verdeling, 100 procent",
				children: RTTI_ORDER.map((k, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: cn("relative flex min-w-0 items-center justify-center text-xs font-medium tabular-nums", FILL[k]),
					style: { width: `${Math.max(0, v[k])}%` },
					children: [v[k] >= 14 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
						k,
						" ",
						v[k]
					] }) : v[k] >= 7 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: k }) : null, i < 3 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						"aria-label": `Grens ${k} / ${RTTI_ORDER[i + 1]}`,
						"aria-valuemin": 0,
						"aria-valuemax": 100,
						"aria-valuenow": v[k],
						className: "absolute top-0 right-0 z-10 h-full w-6 translate-x-1/2 cursor-ew-resize touch-none",
						onPointerDown: (e) => onPointerDown(i, e),
						onPointerMove,
						onPointerUp,
						onPointerCancel: onPointerUp,
						onKeyDown: (e) => {
							if (e.key === "ArrowLeft") {
								e.preventDefault();
								nudge(i, -1);
							}
							if (e.key === "ArrowRight") {
								e.preventDefault();
								nudge(i, 1);
							}
						},
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute top-2 bottom-2 left-1/2 w-1 -translate-x-1/2 rounded-full bg-white/85 shadow-[var(--shadow-border)]" })
					}) : null]
				}, k))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4",
				children: RTTI_ORDER.map((k) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex items-baseline justify-between gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-muted",
						children: [RTTI_META[k].kort, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "hidden sm:inline",
							children: [" · ", RTTI_META[k].naam]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "tabular-nums font-medium",
						children: [v[k], "%"]
					})]
				}, k))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: "Sleep de schotten. Makkelijk, normaal of moeilijk zet de balk terug."
			})
		]
	});
}
var STAPPEN = [
	"Lesstof lezen",
	"Toetsmatrijs met RTTI",
	"Vragen in Cito-stijl",
	"Nakijkmodel en Word-bestand"
];
function CreateForm() {
	const navigate = useNavigate();
	const upsert = useToetsStore((s) => s.upsert);
	const [titel, setTitel] = (0, import_react.useState)("");
	const [vak, setVak] = (0, import_react.useState)("");
	const [leerweg, setLeerweg] = (0, import_react.useState)("KB");
	const [leerjaar, setLeerjaar] = (0, import_react.useState)(2);
	const [versie, setVersie] = (0, import_react.useState)("A");
	const [moeilijkheid, setMoeilijkheid] = (0, import_react.useState)("normaal");
	const [duur, setDuur] = (0, import_react.useState)(50);
	const [punten, setPunten] = (0, import_react.useState)(40);
	const [aantal, setAantal] = (0, import_react.useState)(10);
	const [rtti, setRtti] = (0, import_react.useState)(rttiVoorMoeilijkheid(RTTI_PRESETS.onderbouw.verdeling, "normaal"));
	const [cijferNorm, setCijferNorm] = (0, import_react.useState)(DEFAULT_CIJFER);
	const [vakProfiel, setVakProfiel] = (0, import_react.useState)("generiek");
	const [bron, setBron] = (0, import_react.useState)("");
	const [url, setUrl] = (0, import_react.useState)("");
	const [extra, setExtra] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [stap, setStap] = (0, import_react.useState)(0);
	const [error, setError] = (0, import_react.useState)(null);
	const canSubmit = (bron.trim().length > 0 || url.trim().length > 8) && !busy;
	function rttiVoorJaar(jaar, m) {
		const id = presetVoorLeerjaar(jaar);
		return rttiVoorMoeilijkheid(RTTI_PRESETS[id].verdeling, m);
	}
	function applyJaar(jaar) {
		setLeerjaar(jaar);
		setRtti(rttiVoorJaar(jaar, moeilijkheid));
	}
	function applyMoeilijkheid(m) {
		setMoeilijkheid(m);
		setRtti(rttiVoorJaar(leerjaar, m));
	}
	function applyRtti(next) {
		setRtti(next);
	}
	function applyProfiel(p) {
		setVakProfiel(p);
		if (p === "nask") {
			if (!vak.trim()) setVak("NaSk");
			setRtti(rttiVoorJaar(leerjaar, moeilijkheid));
		} else if (vak === "NaSk") setVak("");
	}
	const regel = bevestigingsRegel({
		leerweg,
		leerjaar,
		versie,
		moeilijkheid,
		duurMinuten: duur,
		aantalVragen: aantal,
		doelPunten: punten,
		model: cijferNorm.model
	});
	const regelMetProfiel = vakProfiel === "nask" ? `${regel} · vakprofiel NaSk` : regel;
	async function onFile(list) {
		const file = list?.[0];
		if (!file) return;
		if (file.size > 2e6) {
			toast.error("Bestand is te groot (max. 2 MB).");
			return;
		}
		try {
			const text = await leesBronBestand(file);
			if (!text) {
				toast.error("Geen tekst in dit bestand. Plak de inhoud.");
				return;
			}
			setBron((prev) => prev ? `${prev}\n\n${text}` : text);
			toast.success(`Ingelezen: ${file.name}`);
		} catch {
			toast.error("Dit bestand kon niet worden gelezen. Plak de tekst.");
		}
	}
	async function onWijzigFile(list) {
		const file = list?.[0];
		if (!file) return;
		if (file.size > 2e6) {
			toast.error("Bestand is te groot (max. 2 MB).");
			return;
		}
		try {
			const text = await leesBronBestand(file);
			if (!text) {
				toast.error("Geen tekst in dit bestand. Typ de wijzigingen.");
				return;
			}
			setExtra((prev) => prev ? `${prev}\n\n${text}` : text);
			toast.success(`Wijzigingen ingelezen: ${file.name}`);
		} catch {
			toast.error("Dit bestand kon niet worden gelezen. Typ de wijzigingen.");
		}
	}
	async function onSubmit(e) {
		e.preventDefault();
		if (!canSubmit) return;
		setBusy(true);
		setError(null);
		setStap(0);
		const timer = window.setInterval(() => {
			setStap((s) => s < STAPPEN.length - 1 ? s + 1 : s);
		}, 2200);
		const input = {
			titel: titel.trim(),
			vak: vak.trim(),
			leerweg,
			leerjaar,
			duurMinuten: duur,
			doelPunten: punten,
			aantalVragen: aantal,
			rttiDoel: rtti,
			bronmateriaal: bron,
			extraEisen: extra,
			bronUrl: url.trim() || void 0,
			versie,
			moeilijkheid,
			cijferNorm,
			vakProfiel,
			ronde: 1
		};
		try {
			const result = await generateToets({ data: input });
			if (!result.ok) {
				setError(result.error);
				toast.error(result.error);
				return;
			}
			upsert(result.toets);
			try {
				const { downloadPakketDocx } = await import("./docx-export-BI__qTTL.mjs");
				await downloadPakketDocx(result.toets);
				toast.success("Word-pakket gedownload.");
			} catch (err) {
				toast.error(err instanceof Error ? err.message : "Download werd geblokkeerd. Tik Word op de toets.");
			}
			navigate({
				to: "/toets/$id",
				params: { id: result.toets.id }
			});
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Er ging iets mis bij het maken.";
			setError(msg);
			toast.error(msg);
		} finally {
			window.clearInterval(timer);
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
		onSubmit,
		className: "grid min-w-0 gap-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-3xl font-bold tracking-tight text-brand sm:text-4xl",
					children: "Toets maken"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 max-w-xl text-pretty leading-relaxed text-muted",
					children: "Plak alleen de lesstof → Toets maken. Het Word-pakket (leerlingblad, nakijkmodel, matrijs, cijfer) downloadt vanzelf. Tik Word als dat niet gebeurt."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-4 text-sm font-medium leading-relaxed text-brand",
					children: regelMetProfiel
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid min-w-0 gap-4 rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-2xl font-bold tracking-tight text-brand",
						children: "Lesstof"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 leading-relaxed text-muted",
						children: "Plak de tekst, of kies een bestand of openbare link."
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "bron",
						className: "sr-only",
						children: "Lesstof"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
						id: "bron",
						value: bron,
						onChange: (e) => setBron(e.target.value),
						placeholder: "Plak de lesstof. Titel, vak en leerdoelen worden vanzelf ingevuld.",
						className: "min-h-56 bg-paper"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-3 sm:flex-row sm:items-center",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								htmlFor: "bestand",
								className: "inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-[var(--radius-md)] bg-paper px-4 text-sm font-semibold text-brand hover:opacity-90",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileUp, { className: "size-4 shrink-0" }),
									"Bestand",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										id: "bestand",
										type: "file",
										accept: ".txt,.md,.csv,.json,.docx,.doc,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
										className: "sr-only",
										onChange: (e) => onFile(e.target.files)
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "button",
								variant: "ghost",
								onClick: () => {
									setVakProfiel("generiek");
									if (vak === "NaSk") setVak("");
									setBron(VOORBEELD_LESSTOF);
									toast.success("Voorbeeldstof ingevuld. Tik Toets maken.");
								},
								children: "Voorbeeldstof"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "button",
								variant: "ghost",
								onClick: () => {
									setVakProfiel("nask");
									setVak("NaSk");
									setBron(VOORBEELD_NASK_LESSTOF);
									toast.success("Voorbeeld NaSk ingevuld. Check de regel en tik Toets maken.");
								},
								children: "Voorbeeld NaSk"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "url",
								type: "url",
								inputMode: "url",
								placeholder: "Of een openbare link",
								value: url,
								onChange: (e) => setUrl(e.target.value),
								className: "sm:flex-1"
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid min-w-0 gap-4 rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-2xl font-bold tracking-tight text-brand",
						children: "Wijzigingen"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 leading-relaxed text-muted",
						children: "Extra wensen bij deze toets: typ ze, of lever een Word-bestand in. Ze gaan mee in deze ronde."
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "extra",
						className: "sr-only",
						children: "Wijzigingen of extra wensen"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
						id: "extra",
						value: extra,
						onChange: (e) => setExtra(e.target.value),
						placeholder: "Bijv. geen meerkeuze, kortere stam bij vraag 3, of een andere context.",
						className: "min-h-32 bg-paper"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						htmlFor: "wijzig-bestand",
						className: "inline-flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-[var(--radius-md)] bg-paper px-4 text-sm font-semibold text-brand hover:opacity-90",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileUp, { className: "size-4 shrink-0" }),
							"Word-bestand",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								id: "wijzig-bestand",
								type: "file",
								accept: ".txt,.md,.docx,.doc,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
								className: "sr-only",
								onChange: (e) => onWijzigFile(e.target.files)
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
				className: "group min-w-0 overflow-hidden rounded-[var(--radius-xl)] bg-surface",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("summary", {
					className: "flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-6 py-5 text-2xl font-bold tracking-tight text-brand hover:opacity-80 sm:px-8 [&::-webkit-details-marker]:hidden",
					children: ["Instellingen", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-5 shrink-0 text-muted transition-transform duration-[var(--motion-quick)] ease-[var(--ease-out)] group-open:rotate-180" })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid gap-6 px-6 pb-8 pt-1 sm:px-8",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "leading-relaxed text-muted",
							children: "Standaard: KB klas 2, versie A, normaal, lineair 1,0–10,0. HGL volgt GT. Leeg vak = automatisch uit de lesstof. De regel boven Toets maken toont altijd wat er meegaat. NaSk: rekenmachine alleen waar nodig, geen boek, RTTI volgens leerjaar."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Choice, {
							legend: "Vakprofiel",
							value: vakProfiel,
							onChange: applyProfiel,
							options: VAKPROFIELEN
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "titel",
								children: "Titel"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "titel",
								value: titel,
								onChange: (e) => setTitel(e.target.value),
								placeholder: "Leeg = automatisch"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "vak",
								children: "Vak"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "vak",
								value: vak,
								onChange: (e) => setVak(e.target.value),
								placeholder: "Leeg = automatisch uit de lesstof"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "jaar",
								children: "Leerjaar"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
								id: "jaar",
								value: leerjaar,
								onChange: (e) => applyJaar(Number(e.target.value)),
								className: "flex h-12 w-full rounded-[var(--radius-md)] border border-transparent bg-paper px-4 text-sm text-fg focus-visible:border-brand/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
								children: [
									1,
									2,
									3,
									4
								].map((j) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
									value: j,
									children: ["Klas ", j]
								}, j))
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Choice, {
							legend: "Niveau",
							value: leerweg,
							onChange: setLeerweg,
							options: LEERWEGEN
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Choice, {
							legend: "Versie",
							value: versie,
							onChange: setVersie,
							options: VERSIES
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid grid-cols-3 gap-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
										htmlFor: "duur",
										children: "Minuten"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										id: "duur",
										type: "number",
										min: 10,
										max: 180,
										value: duur,
										onChange: (e) => setDuur(Number(e.target.value))
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
										htmlFor: "punten",
										children: "Punten"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										id: "punten",
										type: "number",
										min: 10,
										max: 100,
										value: punten,
										onChange: (e) => setPunten(Number(e.target.value))
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
										htmlFor: "aantal",
										children: "Vragen"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										id: "aantal",
										type: "number",
										min: 4,
										max: 16,
										value: aantal,
										onChange: (e) => setAantal(Number(e.target.value))
									})]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "text-sm font-semibold text-brand",
								children: "Cijfernorm"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CijferNormControls, {
								value: cijferNorm,
								onChange: setCijferNorm,
								max: punten
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Choice, {
								legend: "Moeilijkheid",
								value: moeilijkheid,
								onChange: applyMoeilijkheid,
								options: MOEILIJKHEDEN
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RttiPicker, {
								value: rtti,
								onChange: applyRtti
							})]
						})
					]
				})]
			}),
			busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				role: "status",
				"aria-live": "polite",
				className: "rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "flex items-center gap-2 font-semibold text-brand",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }), "Toets wordt opgebouwd…"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
					className: "mt-3 grid gap-1 text-sm",
					children: STAPPEN.map((s, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: cn(i <= stap ? "text-fg" : "text-muted"),
						children: [i < stap ? "Klaar — " : i === stap ? "Bezig — " : "", s]
					}, s))
				})]
			}) : null,
			error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-warn",
				children: error
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-[var(--radius-lg)] bg-surface px-5 py-4 sm:px-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs font-semibold uppercase tracking-[0.14em] text-muted",
					children: "Dit gaat mee"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm font-medium leading-relaxed text-brand",
					children: regelMetProfiel
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				type: "submit",
				disabled: !canSubmit,
				className: "h-auto min-h-20 w-full justify-between rounded-[var(--radius-lg)] px-6 py-5 text-left sm:px-8 [&_svg]:size-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "min-w-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block text-xl font-bold",
						children: busy ? "Bezig…" : "Toets maken"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "mt-1 block text-sm font-medium opacity-80",
						children: "Word-pakket volgt automatisch."
					})]
				}), busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-6 shrink-0 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "size-6 shrink-0" })]
			})
		]
	});
}
function Library() {
	const toetsen = useToetsStore((s) => s.toetsen);
	const remove = useToetsStore((s) => s.remove);
	const ensureVoorbeeld = useToetsStore((s) => s.ensureVoorbeeld);
	const ensureVoorbeeldNask = useToetsStore((s) => s.ensureVoorbeeldNask);
	const navigate = useNavigate();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "mt-5 min-w-0 rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-start justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-2xl font-bold tracking-tight text-brand",
				children: "Opgeslagen"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 leading-relaxed text-muted",
				children: "Blijft op dit apparaat. Tik Voorbeeld voor een kant-en-klare toets, zonder te wachten."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex shrink-0 flex-col gap-2 sm:flex-row",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					variant: "ghost",
					onClick: () => {
						const t = ensureVoorbeeld();
						navigate({
							to: "/toets/$id",
							params: { id: t.id }
						});
					},
					children: "Voorbeeld"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					variant: "ghost",
					onClick: () => {
						const t = ensureVoorbeeldNask();
						navigate({
							to: "/toets/$id",
							params: { id: t.id }
						});
					},
					children: "Voorbeeld NaSk"
				})]
			})]
		}), toetsen.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-5 leading-relaxed text-muted",
			children: "Nog geen toetsen op dit apparaat."
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-5",
			children: toetsen.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "flex items-center gap-3 border-t border-brand/10 py-2 first:border-t-0 first:pt-0",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/toets/$id",
						params: { id: t.id },
						className: "min-w-0 flex-1 py-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "truncate font-semibold text-brand",
							children: t.meta.titel
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-0.5 text-sm text-muted",
							children: [
								t.soort === "matrijs" ? "Matrijs · " : "",
								t.meta.vak,
								" · ",
								t.meta.leerweg,
								" ",
								t.meta.leerjaar,
								" ·",
								" ",
								t.meta.versie ?? "A"
							]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						variant: "ghost",
						size: "icon",
						"aria-label": "Word-pakket",
						onClick: async () => {
							const full = withDefaults(t);
							if (full.soort === "matrijs") {
								const { downloadMatrijsDocx } = await import("./docx-export-BI__qTTL.mjs");
								await downloadMatrijsDocx(full);
								return;
							}
							const { downloadPakketDocx } = await import("./docx-export-BI__qTTL.mjs");
							await downloadPakketDocx(full);
						},
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileDown, { className: "size-4" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						variant: "ghost",
						size: "icon",
						"aria-label": "Verwijderen",
						onClick: () => remove(t.id),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-4" })
					})
				]
			}, t.id))
		})]
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Page, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CreateForm, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Library, {})] }) });
}
//#endregion
export { Home as component };
