import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as PageIntro, i as Page, t as AppShell } from "./app-shell-BwgW9Zae.mjs";
import { t as DEFAULT_CIJFER } from "./cijfer-CM0wPsdC.mjs";
import { CijferPanel } from "./cijfer-panel-XxTeYeoT.mjs";
import { n as toast } from "../_libs/sonner.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/cijfer-BrZxFrW9.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function CijferPage() {
	const [max, setMax] = (0, import_react.useState)(40);
	const [norm, setNorm] = (0, import_react.useState)(DEFAULT_CIJFER);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Page, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageIntro, {
		title: "Cijfer berekenen",
		children: "Punten omzetten zonder een toets te maken. De tabel download je als Word."
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CijferPanel, {
			titel: "",
			max,
			maxEditable: true,
			onMaxChange: setMax,
			norm,
			onChange: setNorm,
			onExport: async () => {
				try {
					const { downloadCijferTabelDocx } = await import("./docx-export-BI__qTTL.mjs");
					await downloadCijferTabelDocx({
						titel: "Cijferomzetting",
						max,
						norm
					});
					toast.success("Word-bestand gedownload");
				} catch (err) {
					toast.error(err instanceof Error ? err.message : "Download mislukt");
				}
			}
		})
	})] }) });
}
//#endregion
export { CijferPage as component };
