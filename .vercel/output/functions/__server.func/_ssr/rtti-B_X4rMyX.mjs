import { i as RTTI_ORDER } from "./constants-C-iIXaRj.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/rtti-B_X4rMyX.js
function somVerdeling(v) {
	return v.R + v.T1 + v.T2 + v.I;
}
function normaliseer(v) {
	const som = somVerdeling(v);
	if (som <= 0) return {
		R: 25,
		T1: 25,
		T2: 25,
		I: 25
	};
	const rounded = RTTI_ORDER.map((k) => v[k] / som * 100).map((n) => Math.round(n));
	const drift = 100 - rounded.reduce((a, b) => a + b, 0);
	rounded[0] += drift;
	return {
		R: rounded[0],
		T1: rounded[1],
		T2: rounded[2],
		I: rounded[3]
	};
}
function totaalPunten(vragen) {
	return vragen.reduce((s, q) => s + (Number(q.punten) || 0), 0);
}
function puntenPerRtti(vragen) {
	const out = {
		R: 0,
		T1: 0,
		T2: 0,
		I: 0
	};
	for (const q of vragen) if (out[q.rtti] !== void 0) out[q.rtti] += Number(q.punten) || 0;
	return out;
}
function percentagePerRtti(vragen) {
	const totaal = totaalPunten(vragen);
	const p = puntenPerRtti(vragen);
	if (totaal <= 0) return {
		R: 0,
		T1: 0,
		T2: 0,
		I: 0
	};
	const rounded = RTTI_ORDER.map((k) => p[k] / totaal * 100).map((n) => Math.round(n));
	const drift = 100 - rounded.reduce((a, b) => a + b, 0);
	rounded[0] += drift;
	return {
		R: rounded[0],
		T1: rounded[1],
		T2: rounded[2],
		I: rounded[3]
	};
}
function bouwMatrijs(vragen, doelverdeling) {
	const domeinen = [];
	const cellen = {};
	const emptyCel = () => ({
		vraagnummers: [],
		punten: 0
	});
	for (const q of vragen) {
		const domein = q.domein?.trim() || "Algemeen";
		if (!domeinen.includes(domein)) domeinen.push(domein);
		if (!cellen[domein]) cellen[domein] = {
			R: emptyCel(),
			T1: emptyCel(),
			T2: emptyCel(),
			I: emptyCel()
		};
		const cel = cellen[domein][q.rtti];
		cel.vraagnummers.push(q.nummer);
		cel.punten += Number(q.punten) || 0;
	}
	const p = puntenPerRtti(vragen);
	const perc = percentagePerRtti(vragen);
	return {
		domeinen,
		cellen,
		totalen: {
			R: {
				punten: p.R,
				percentage: perc.R
			},
			T1: {
				punten: p.T1,
				percentage: perc.T1
			},
			T2: {
				punten: p.T2,
				percentage: perc.T2
			},
			I: {
				punten: p.I,
				percentage: perc.I
			}
		},
		doelverdeling: normaliseer(doelverdeling)
	};
}
function herbouwMatrijs(toets) {
	return {
		...toets,
		matrijs: bouwMatrijs(toets.vragen, toets.matrijs.doelverdeling)
	};
}
function afwijking(actual, doel) {
	const d = actual - doel;
	if (Math.abs(d) <= 5) return "ok";
	return d > 0 ? "ruim" : "krap";
}
//#endregion
export { somVerdeling as a, normaliseer as i, bouwMatrijs as n, totaalPunten as o, herbouwMatrijs as r, afwijking as t };
