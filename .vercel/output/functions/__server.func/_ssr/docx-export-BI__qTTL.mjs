import { a as cesuurZin, c as formuleTekst, d as modelLabel, m as voldoendeHint, p as omzetTabel } from "./cijfer-CM0wPsdC.mjs";
import { i as RTTI_ORDER, r as RTTI_META, s as SCHOOL } from "./constants-C-iIXaRj.mjs";
import { o as totaalPunten } from "./rtti-B_X4rMyX.mjs";
import { t as withDefaults } from "./defaults-gTpbcpJZ.mjs";
import { a as Header, c as PageBreak, d as Table, f as TableCell, g as WidthType, h as VerticalAlign, i as Footer, l as PageNumber, m as TextRun, n as BorderStyle, o as HeadingLevel, p as TableRow, r as File, s as Packer, t as AlignmentType, u as Paragraph } from "../_libs/docx.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/docx-export-BI__qTTL.js
function slug(s) {
	return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "toets";
}
var GREEN = "004422";
var INK = "0A2E22";
var MUTED = "1E4A38";
var thin = {
	style: BorderStyle.SINGLE,
	size: 4,
	color: "C3D7EE"
};
var borders = {
	top: thin,
	bottom: thin,
	left: thin,
	right: thin
};
function p(text, opts) {
	return new Paragraph({
		spacing: { after: 120 },
		children: [new TextRun({
			text,
			font: "Arial",
			size: opts?.size ?? 22,
			bold: opts?.bold,
			italics: opts?.italics,
			color: opts?.color ?? INK
		})]
	});
}
function heading(text) {
	return new Paragraph({
		heading: HeadingLevel.HEADING_1,
		spacing: {
			before: 200,
			after: 160
		},
		children: [new TextRun({
			text,
			font: "Arial",
			size: 32,
			bold: true,
			color: GREEN
		})]
	});
}
function sub(text) {
	return new Paragraph({
		spacing: { after: 80 },
		children: [new TextRun({
			text,
			font: "Arial",
			size: 18,
			color: MUTED
		})]
	});
}
function cell(text, opts) {
	return new TableCell({
		borders,
		width: opts?.width ? {
			size: opts.width,
			type: WidthType.DXA
		} : void 0,
		verticalAlign: VerticalAlign.CENTER,
		shading: opts?.fill ? { fill: opts.fill } : void 0,
		children: [new Paragraph({ children: [new TextRun({
			text,
			font: "Arial",
			size: 18,
			bold: opts?.bold,
			color: INK
		})] })]
	});
}
function headerFooter(label) {
	return {
		headers: { default: new Header({ children: [new Paragraph({ children: [new TextRun({
			text: SCHOOL,
			font: "Arial",
			size: 16,
			color: GREEN,
			bold: true
		}), new TextRun({
			text: `  ·  ${label}`,
			font: "Arial",
			size: 16,
			color: MUTED
		})] })] }) },
		footers: { default: new Footer({ children: [new Paragraph({
			alignment: AlignmentType.RIGHT,
			children: [new TextRun({
				text: "blad ",
				font: "Arial",
				size: 16,
				color: MUTED
			}), new TextRun({
				children: [PageNumber.CURRENT],
				font: "Arial",
				size: 16,
				color: MUTED
			})]
		})] }) }
	};
}
function asciiGrafiek(g) {
	const pts = [...g.punten].sort((a, b) => a.x - b.x);
	if (pts.length < 2) return pts.map((pt) => `${pt.x} → ${pt.y}`);
	const rows = 6;
	const cols = 28;
	const xs = pts.map((p) => p.x);
	const ys = pts.map((p) => p.y);
	const minX = Math.min(...xs);
	const maxX = Math.max(...xs);
	const minY = Math.min(...ys);
	const maxY = Math.max(...ys);
	const spanX = maxX - minX || 1;
	const spanY = maxY - minY || 1;
	const grid = Array.from({ length: rows }, () => Array(cols).fill(" "));
	for (const p of pts) {
		const c = Math.round((p.x - minX) / spanX * 27);
		const r = 5 - Math.round((p.y - minY) / spanY * 5);
		grid[r][c] = "*";
	}
	const fmt = (n) => String(n).replace(".", ",");
	const lines = grid.map((row, i) => {
		return `${i === 0 ? fmt(maxY).padStart(6) : i === 5 ? fmt(minY).padStart(6) : "      "} |${row.join("")}`;
	});
	lines.push(`       +${"-".repeat(cols)}`);
	lines.push(`        ${g.xLabel || "x"}  ${fmt(minX)} … ${fmt(maxX)}${g.yLabel ? `   (${g.yLabel})` : ""}`);
	return lines;
}
function toetsParagrafen(toets) {
	const t = withDefaults(toets);
	const m = t.meta;
	const max = totaalPunten(t.vragen);
	const out = [
		heading(m.titel),
		sub(`${m.vak} · ${m.leerweg} klas ${m.leerjaar} · versie ${m.versie} · ${m.moeilijkheid}`),
		p(`Tijd: ${m.duurMinuten} minuten. Maximumscore: ${max} punten. ${t.vragen.length} vragen.`),
		p("Naam: ________________________    Klas: ________    Datum: ________"),
		p(`Hulpmiddelen: ${m.hulpmiddelen.join(" · ") || "geen"}`, { italics: true })
	];
	if (m.instructies.length) {
		out.push(p("Instructie", { bold: true }));
		for (const s of m.instructies) out.push(p(`• ${s}`));
	}
	for (const q of t.vragen) {
		out.push(p(`Vraag ${q.nummer}  (${q.punten} punten)`, {
			bold: true,
			size: 24
		}));
		if (q.context) out.push(p(q.context, { italics: true }));
		for (const line of q.stam.split("\n")) out.push(p(line || " "));
		if (q.tabel?.koppen.length) {
			const rows = [new TableRow({ children: q.tabel.koppen.map((k) => cell(k, {
				bold: true,
				fill: "E8F0EA"
			})) }), ...q.tabel.rijen.map((rij) => new TableRow({ children: rij.map((c) => cell(c)) }))];
			out.push(new Table({
				width: {
					size: 9e3,
					type: WidthType.DXA
				},
				rows
			}));
		}
		if (q.grafiek?.punten.length) {
			out.push(p(q.grafiek.titel || "Grafiek", { bold: true }));
			for (const line of asciiGrafiek(q.grafiek)) out.push(new Paragraph({
				spacing: { after: 40 },
				children: [new TextRun({
					text: line,
					font: "Courier New",
					size: 16,
					color: INK
				})]
			}));
		}
		if (q.opties?.length) for (const o of q.opties) out.push(p(`${o.letter}.  ${o.tekst}`));
	}
	return out;
}
function nakijkParagrafen(toets) {
	const t = withDefaults(toets);
	const max = totaalPunten(t.vragen);
	const tabel = omzetTabel(max, t.cijferNorm);
	const out = [
		heading(`Nakijkmodel · ${t.meta.titel}`),
		sub("Niet voor leerlingen"),
		p(formuleTekst(t.cijferNorm, max), { bold: true }),
		p(cesuurZin(max, t.cijferNorm)),
		p("Omzettingstabel (punten → cijfer)", { bold: true })
	];
	const rows = [new TableRow({ children: [cell("Punten", { bold: true }), cell("Cijfer", { bold: true })] })];
	for (const rij of tabel) rows.push(new TableRow({ children: [cell(String(rij.punten)), cell(rij.cijfer.toFixed(1).replace(".", ","))] }));
	out.push(new Table({
		width: {
			size: 4e3,
			type: WidthType.DXA
		},
		rows
	}));
	for (const n of t.nakijkmodel) {
		const q = t.vragen.find((v) => v.nummer === n.nummer);
		out.push(p(`Vraag ${n.nummer}  (${q?.punten ?? "?"}p)  ${q ? RTTI_META[q.rtti].kort : ""}  ${q?.domein ?? ""}`, { bold: true }));
		out.push(p(`Modelantwoord: ${n.modelantwoord}`));
		for (const pc of n.puntenverdeling) out.push(p(`  ${pc.punt}p — ${pc.criterium}`));
		if (n.nietToekennen?.length) out.push(p(`Niet toekennen: ${n.nietToekennen.join(" · ")}`, { italics: true }));
	}
	return out;
}
function matrijsBlocks(toets) {
	const t = withDefaults(toets);
	const { matrijs } = t;
	const max = totaalPunten(t.vragen);
	const header = [
		cell("Domein", {
			bold: true,
			fill: "E8F0EA"
		}),
		...RTTI_ORDER.map((k) => cell(RTTI_META[k].kort, {
			bold: true,
			fill: "E8F0EA"
		})),
		cell("Totaal", {
			bold: true,
			fill: "E8F0EA"
		})
	];
	const rows = [new TableRow({ children: header })];
	for (const d of matrijs.domeinen) {
		const row = matrijs.cellen[d];
		const tot = RTTI_ORDER.reduce((s, k) => s + (row?.[k]?.punten ?? 0), 0);
		rows.push(new TableRow({ children: [
			cell(d, { bold: true }),
			...RTTI_ORDER.map((k) => {
				const cel = row?.[k];
				if (!cel || cel.punten <= 0) return cell("—");
				return cell(`${cel.vraagnummers.map((n) => `v${n}`).join(" ")} (${cel.punten}p)`);
			}),
			cell(`${tot}p`, { bold: true })
		] }));
	}
	rows.push(new TableRow({ children: [
		cell("Totaal", { bold: true }),
		...RTTI_ORDER.map((k) => cell(`${matrijs.totalen[k].punten}p · ${matrijs.totalen[k].percentage}%`, { bold: true })),
		cell(`${max}p`, { bold: true })
	] }));
	const out = [
		heading(`Toetsmatrijs · ${t.meta.titel}`),
		sub(`RTTI · versie ${t.meta.versie} · ${t.meta.leerweg} klas ${t.meta.leerjaar}`),
		new Table({
			width: {
				size: 9360,
				type: WidthType.DXA
			},
			rows
		}),
		p(" "),
		p("Leerdoelen per vraag", { bold: true })
	];
	for (const q of t.vragen) out.push(p(`v${q.nummer}  ${q.leerdoel}  (${q.domein} · ${q.punten}p · ${RTTI_META[q.rtti].naam})`));
	if (t.soort === "matrijs" && t.kwaliteit?.punten?.length) {
		out.push(p(" "), heading("Feedback op de toets"));
		out.push(p(t.kwaliteit.samenvatting));
		for (const k of t.kwaliteit.punten) out.push(p(`${k.criterium} · ${k.oordeel}`, { bold: true }), p(k.toelichting));
	}
	return out;
}
function cijferParagrafenVan(max, norm, titel, subregel) {
	const tabel = omzetTabel(max, norm);
	const rows = [new TableRow({ children: [cell("Punten", {
		bold: true,
		fill: "E8F0EA"
	}), cell("Cijfer", {
		bold: true,
		fill: "E8F0EA"
	})] })];
	for (const rij of tabel) rows.push(new TableRow({ children: [cell(String(rij.punten)), cell(rij.cijfer.toFixed(1).replace(".", ","))] }));
	return [
		heading(titel),
		sub(subregel),
		p(formuleTekst(norm, max), { bold: true }),
		p(voldoendeHint(norm)),
		p(cesuurZin(max, norm)),
		p("Omzettingstabel (punten → cijfer)", { bold: true }),
		new Table({
			width: {
				size: 4e3,
				type: WidthType.DXA
			},
			rows
		})
	];
}
function cijferParagrafen(toets) {
	const t = withDefaults(toets);
	return cijferParagrafenVan(totaalPunten(t.vragen), t.cijferNorm, `Cijferomzetting · ${t.meta.titel}`, `${modelLabel(t.cijferNorm.model)} · versie ${t.meta.versie} · ${t.meta.leerweg} klas ${t.meta.leerjaar}`);
}
function docOf(children, label) {
	return new File({
		styles: { default: { document: { run: {
			font: "Arial",
			size: 22
		} } } },
		sections: [{
			properties: { page: { size: {
				width: 11906,
				height: 16838
			} } },
			...headerFooter(label),
			children
		}]
	});
}
async function saveDoc(doc, filename) {
	const blob = await Packer.toBlob(doc);
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.rel = "noopener";
	a.type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
	a.style.display = "none";
	document.body.appendChild(a);
	a.click();
	await new Promise((resolve) => window.setTimeout(resolve, 1500));
	a.remove();
	URL.revokeObjectURL(url);
}
async function downloadMatrijsDocx(toets) {
	const t = withDefaults(toets);
	await saveDoc(docOf(matrijsBlocks(t), `Toetsmatrijs versie ${t.meta.versie}`), `${slug(t.meta.titel)}-versie-${t.meta.versie}-matrijs.docx`);
}
async function downloadCijferDocx(toets) {
	const t = withDefaults(toets);
	await saveDoc(docOf(cijferParagrafen(t), `Cijferomzetting versie ${t.meta.versie}`), `${slug(t.meta.titel)}-versie-${t.meta.versie}-cijfer.docx`);
}
async function downloadCijferTabelDocx(opts) {
	const titel = opts.titel?.trim() || "Cijferomzetting";
	await saveDoc(docOf(cijferParagrafenVan(opts.max, opts.norm, titel, `${modelLabel(opts.norm.model)} · maximum ${opts.max} punten`), "Cijferomzetting"), `${slug(titel)}-${opts.norm.model}-${opts.max}p.docx`);
}
async function downloadPakketDocx(toets) {
	const t = withDefaults(toets);
	await saveDoc(new File({
		styles: { default: { document: { run: {
			font: "Arial",
			size: 22
		} } } },
		sections: [
			{
				properties: { page: { size: {
					width: 11906,
					height: 16838
				} } },
				...headerFooter(`Toets versie ${t.meta.versie}`),
				children: toetsParagrafen(t)
			},
			{
				properties: { page: { size: {
					width: 11906,
					height: 16838
				} } },
				...headerFooter("Nakijkmodel — niet voor leerlingen"),
				children: [new Paragraph({ children: [new PageBreak()] }), ...nakijkParagrafen(t)]
			},
			{
				properties: { page: { size: {
					width: 11906,
					height: 16838
				} } },
				...headerFooter("Toetsmatrijs — niet voor leerlingen"),
				children: [...matrijsBlocks(t)]
			},
			{
				properties: { page: { size: {
					width: 11906,
					height: 16838
				} } },
				...headerFooter("Cijferomzetting — niet voor leerlingen"),
				children: [...cijferParagrafen(t)]
			}
		]
	}), `${slug(t.meta.titel)}-versie-${t.meta.versie}-pakket.docx`);
}
//#endregion
export { downloadCijferDocx, downloadCijferTabelDocx, downloadMatrijsDocx, downloadPakketDocx };
