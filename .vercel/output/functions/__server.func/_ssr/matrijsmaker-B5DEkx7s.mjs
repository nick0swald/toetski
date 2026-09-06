import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime, b as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as Page, n as Button, o as cn, t as AppShell } from "./app-shell-BwgW9Zae.mjs";
import { n as Input, r as Label, t as Choice } from "./choice-DWGYfizw.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { a as RTTI_PRESETS, o as RTTI_PRESET_KEUZES } from "./constants-C-iIXaRj.mjs";
import { i as leesBronBestand, n as generateMatrijs, t as Textarea } from "./lees-bron-CulWuLbY.mjs";
import { o as useToetsStore, r as VOORBEELD_TOETS_TEKST } from "./toets-store-ieR5MTKz.mjs";
import { i as FileUp, r as LoaderCircle, s as ArrowRight } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/matrijsmaker-B5DEkx7s.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function MatrijsForm() {
	const navigate = useNavigate();
	const upsert = useToetsStore((s) => s.upsert);
	const [bron, setBron] = (0, import_react.useState)("");
	const [vak, setVak] = (0, import_react.useState)("");
	const [leerjaar, setLeerjaar] = (0, import_react.useState)(2);
	const [preset, setPreset] = (0, import_react.useState)("onderbouw");
	const [feedback, setFeedback] = (0, import_react.useState)(false);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [stap, setStap] = (0, import_react.useState)(0);
	const [error, setError] = (0, import_react.useState)(null);
	const [bestandsnaam, setBestandsnaam] = (0, import_react.useState)(null);
	const stappen = feedback ? [
		"Toets lezen",
		"Vragen en RTTI toewijzen",
		"Toetsmatrijs",
		"Feedback",
		"Word-bestand"
	] : [
		"Toets lezen",
		"Vragen en RTTI toewijzen",
		"Toetsmatrijs",
		"Word-bestand"
	];
	const canSubmit = bron.trim().length > 0 && !busy;
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
				toast.error("Geen tekst in dit bestand. Plak de toets.");
				return;
			}
			setBron(text);
			setBestandsnaam(file.name);
			toast.success(`Ingelezen: ${file.name}`);
		} catch {
			toast.error("Dit bestand kon niet worden gelezen. Plak de tekst.");
		}
	}
	async function onSubmit(e) {
		e.preventDefault();
		if (!canSubmit) return;
		setBusy(true);
		setError(null);
		setStap(0);
		const timer = window.setInterval(() => {
			setStap((s) => s < stappen.length - 1 ? s + 1 : s);
		}, 1800);
		try {
			const result = await generateMatrijs({ data: {
				vak: vak.trim(),
				leerweg: "KB",
				leerjaar,
				rttiDoel: RTTI_PRESETS[preset].verdeling,
				bronmateriaal: bron,
				feedbackGewenst: feedback
			} });
			if (!result.ok) {
				setError(result.error);
				toast.error(result.error);
				return;
			}
			upsert(result.toets);
			try {
				const { downloadMatrijsDocx } = await import("./docx-export-BI__qTTL.mjs");
				await downloadMatrijsDocx(result.toets);
				toast.success(feedback ? "Matrijs en feedback gedownload." : "Matrijs gedownload.");
			} catch (err) {
				toast.error(err instanceof Error ? err.message : "Download werd geblokkeerd. Tik Word op de matrijs.");
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
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-3xl font-bold tracking-tight text-brand sm:text-4xl",
				children: "Matrijsmaker"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 max-w-xl text-pretty leading-relaxed text-muted",
				children: "Lever een toets in die je al hebt. Geen kaders, geen nieuwe vragen — alleen de RTTI-matrijs als Word-bestand. Feedback is optioneel."
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid min-w-0 gap-4 rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-2xl font-bold tracking-tight text-brand",
						children: "Bestaande toets"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 leading-relaxed text-muted",
						children: "Kies een Word-bestand, of plak de vragen."
					})] }),
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
									setBron(VOORBEELD_TOETS_TEKST);
									setBestandsnaam(null);
									toast.success("Voorbeeldtoets ingevuld. Tik Matrijs maken.");
								},
								children: "Voorbeeldtoets"
							}),
							bestandsnaam ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-muted",
								children: bestandsnaam
							}) : null
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "bron",
						className: "sr-only",
						children: "Bestaande toets"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
						id: "bron",
						value: bron,
						onChange: (e) => {
							setBron(e.target.value);
							setBestandsnaam(null);
						},
						placeholder: "Of plak hier de bestaande toets.",
						className: "min-h-56 bg-paper"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid min-w-0 gap-5 rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "matrijs-vak",
							children: "Vak"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "matrijs-vak",
							value: vak,
							onChange: (e) => setVak(e.target.value),
							placeholder: "Leeg = automatisch uit de toets"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "matrijs-jaar",
							children: "Leerjaar"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
							id: "matrijs-jaar",
							value: leerjaar,
							onChange: (e) => {
								const jaar = Number(e.target.value);
								setLeerjaar(jaar);
								setPreset(jaar <= 2 ? "onderbouw" : jaar === 4 ? "examen" : "bovenbouw");
							},
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
						legend: "Doel-RTTI",
						value: preset,
						onChange: setPreset,
						options: RTTI_PRESET_KEUZES
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "flex min-h-14 cursor-pointer items-start gap-3 rounded-[var(--radius-xl)] bg-surface px-6 py-5 sm:px-8",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					id: "feedback",
					type: "checkbox",
					checked: feedback,
					onChange: (e) => setFeedback(e.target.checked),
					className: "mt-1 size-5 shrink-0 accent-primary"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "block font-bold text-brand",
					children: "Feedback op deze toets"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "mt-1 block leading-relaxed text-muted",
					children: "RTTI-spreiding, validiteit, taal en Cito-opmaak. Uit = alleen de matrijs."
				})] })]
			}),
			busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				role: "status",
				"aria-live": "polite",
				className: "rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "flex items-center gap-2 font-semibold text-brand",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }), "Matrijs wordt opgebouwd…"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
					className: "mt-3 grid gap-1 text-sm",
					children: stappen.map((s, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
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
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1 text-sm font-medium leading-relaxed text-brand",
					children: [
						vak.trim() || "vak uit de toets",
						" · leerjaar ",
						leerjaar,
						" ·",
						" ",
						RTTI_PRESETS[preset].label,
						feedback ? " · met feedback" : " · alleen matrijs"
					]
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
						children: busy ? "Bezig…" : "Matrijs maken"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "mt-1 block text-sm font-medium opacity-80",
						children: feedback ? "Toetsmatrijs plus feedback, als Word." : "Alleen de toetsmatrijs, als Word."
					})]
				}), busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-6 shrink-0 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "size-6 shrink-0" })]
			})
		]
	});
}
function MatrijsmakerPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Page, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MatrijsForm, {}) }) });
}
//#endregion
export { MatrijsmakerPage as component };
