//#region node_modules/.nitro/vite/services/ssr/assets/cijfer-CM0wPsdC.js
var DEFAULT_CIJFER = {
	model: "lineair",
	cesuurPct: 55,
	exponent: 1
};
var VOLDOENDE_PRESETS = {
	makkelijker: {
		cesuurPct: 45,
		exponent: .7
	},
	normaal: {
		cesuurPct: 55,
		exponent: 1
	},
	moeilijker: {
		cesuurPct: 65,
		exponent: 1.45
	}
};
VOLDOENDE_PRESETS.makkelijker, VOLDOENDE_PRESETS.normaal, VOLDOENDE_PRESETS.moeilijker;
function nlCijfer(n) {
	return roundCijfer(n).toFixed(1).replace(".", ",");
}
function roundCijfer(n) {
	return Math.round((Math.min(10, Math.max(1, n)) + Number.EPSILON) * 10) / 10;
}
/** Onrounded cijfer — voor de grafiek, zodat de lijn niet zaagt op 0,1-stappen. */
function cijferVanScoreRaw(score, max, norm = DEFAULT_CIJFER) {
	if (max <= 0) return 1;
	const p = Math.max(0, Math.min(max, score));
	const x = p / max;
	if (norm.model === "lineair") return 1 + 9 * x;
	if (norm.model === "exponentieel") {
		const k = Math.max(.3, Math.min(3, norm.exponent || 1));
		return 1 + 9 * Math.pow(x, k);
	}
	const cesuurScore = Math.max(5, Math.min(95, norm.cesuurPct)) / 100 * max;
	if (p <= cesuurScore) {
		if (cesuurScore <= 0) return 1;
		return 1 + 4.5 * (p / cesuurScore);
	}
	const rest = max - cesuurScore;
	if (rest <= 0) return 10;
	return 5.5 + 4.5 * ((p - cesuurScore) / rest);
}
function cijferVanScore(score, max, norm = DEFAULT_CIJFER) {
	return roundCijfer(cijferVanScoreRaw(score, max, norm));
}
function cesuurPunten(max, norm) {
	for (let s = 0; s <= max; s++) if (cijferVanScore(s, max, norm) >= 5.5) return s;
	return Math.round(.5 * max);
}
function cesuurModelLabel(model) {
	if (model === "lineair") return "lineair";
	if (model === "gebroken") return "gebroken grafiek";
	return "exponentieel";
}
/** Eén zin, overal hetzelfde: nakijkmodel, cijfertabel, instructie. */
function cesuurZin(max, norm) {
	return `Cesuur 5,5 bij ${cesuurPunten(Math.max(1, max), norm)}/${Math.max(1, max)} punten (${cesuurModelLabel(norm.model)}).`;
}
/** Vervangt tegenstrijdige cesuurzinnen in de instructie door de canonieke zin. */
function instructiesMetCesuur(raw, max, norm) {
	return [cesuurZin(max, norm), ...raw.filter((s) => !/cesuur|n-?\s*term|cijfer\s*=|5\s*,\s*5 bij/i.test(s))];
}
function bevestigingsRegel(opts) {
	return `${opts.leerweg} · leerjaar ${opts.leerjaar} · versie ${opts.versie} · ${opts.moeilijkheid} · ${opts.duurMinuten} min · ${opts.aantalVragen} vragen · max ${opts.doelPunten} pt · norm ${opts.model}`;
}
function formuleTekst(norm, max) {
	if (norm.model === "lineair") return `cijfer = 1 + 9 × (score / ${max})   ·  elk punt telt even zwaar, 1,0–10,0`;
	if (norm.model === "exponentieel") return `cijfer = 1 + 9 × (score / ${max})^${norm.exponent.toFixed(2)}   ·  exponentieel`;
	return `Gebroken grafiek: 0p → 1,0  ·  ${cesuurPunten(max, {
		...norm,
		model: "gebroken"
	})}p → 5,5  ·  ${max}p → 10,0`;
}
function modelLabel(model) {
	if (model === "lineair") return "Lineair (1,0–10,0)";
	if (model === "gebroken") return "Gebroken grafiek";
	return "Exponentieel";
}
function applyVoldoende(model, stand) {
	if (model === "lineair") return {
		...DEFAULT_CIJFER,
		model: "lineair"
	};
	const p = VOLDOENDE_PRESETS[stand];
	return {
		model,
		cesuurPct: p.cesuurPct,
		exponent: p.exponent
	};
}
function huidigeVoldoende(norm) {
	if (norm.model === "lineair") return null;
	if (norm.model === "gebroken") {
		if (norm.cesuurPct <= 48) return "makkelijker";
		if (norm.cesuurPct >= 62) return "moeilijker";
		return "normaal";
	}
	if (norm.exponent <= .85) return "makkelijker";
	if (norm.exponent >= 1.25) return "moeilijker";
	return "normaal";
}
function voldoendeHint(norm) {
	if (norm.model === "lineair") return "Bij lineair ligt een 5,5 altijd op 50% van de punten. Kies gebroken of exponentieel om de voldoende te verschuiven.";
	if (norm.model === "gebroken") {
		const pct = Math.round(norm.cesuurPct);
		if (pct < 50) return `Voldoende is relatief makkelijk: 5,5 bij ${pct}% van de punten.`;
		if (pct > 58) return `Voldoende is relatief moeilijk: 5,5 bij ${pct}% van de punten.`;
		return `Voldoende rond de gebruikelijke cesuur: 5,5 bij ${pct}% van de punten.`;
	}
	const k = norm.exponent;
	if (k < .9) return "De kromme buigt omhoog: middelste scores krijgen een hoger cijfer (voldoende makkelijker).";
	if (k > 1.15) return "De kromme buigt omlaag: middelste scores krijgen een lager cijfer (voldoende moeilijker).";
	return "Bijna lineair. Schuif de exponent om de voldoende te verzwaren of te verlichten.";
}
function omzetTabel(max, norm) {
	const out = [];
	const step = max > 50 ? 2 : 1;
	for (let p = 0; p <= max; p += step) out.push({
		punten: p,
		cijfer: cijferVanScore(p, max, norm)
	});
	if (out[out.length - 1]?.punten !== max) out.push({
		punten: max,
		cijfer: cijferVanScore(max, max, norm)
	});
	return out;
}
/**
* Punten voor de grafiek. Lineair en gebroken: alleen de knikpunten
* (strakke segmenten). Exponentieel: dichte, onafgeronde samples.
*/
function curvePunten(max, norm, samples = 64) {
	const safeMax = Math.max(1, max);
	if (norm.model === "lineair") return [{
		p: 0,
		cijfer: 1
	}, {
		p: safeMax,
		cijfer: 10
	}];
	if (norm.model === "gebroken") return [
		{
			p: 0,
			cijfer: 1
		},
		{
			p: Math.max(5, Math.min(95, norm.cesuurPct)) / 100 * safeMax,
			cijfer: 5.5
		},
		{
			p: safeMax,
			cijfer: 10
		}
	];
	const n = Math.max(16, Math.min(samples, 96));
	const out = [];
	for (let i = 0; i <= n; i++) {
		const p = i / n * safeMax;
		out.push({
			p,
			cijfer: cijferVanScoreRaw(p, safeMax, norm)
		});
	}
	return out;
}
//#endregion
export { cesuurZin as a, formuleTekst as c, modelLabel as d, nlCijfer as f, cesuurPunten as i, huidigeVoldoende as l, voldoendeHint as m, applyVoldoende as n, cijferVanScore as o, omzetTabel as p, bevestigingsRegel as r, curvePunten as s, DEFAULT_CIJFER as t, instructiesMetCesuur as u };
