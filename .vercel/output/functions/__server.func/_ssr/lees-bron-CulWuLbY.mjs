import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as cn } from "./app-shell-BwgW9Zae.mjs";
import { i as fieldClassName } from "./choice-DWGYfizw.mjs";
import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "./ssr.mjs";
import { r as matrijsInputSchema, t as generateInputSchema } from "./schema-DSm8tvx7.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/lees-bron-CulWuLbY.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var Textarea = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
	className: cn(fieldClassName, "h-auto min-h-40 py-3", className),
	ref,
	...props
}));
Textarea.displayName = "Textarea";
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var generateToets = createServerFn({ method: "POST" }).validator((input) => generateInputSchema.parse(input)).handler(createSsrRpc("0f9030a556d4ab5feeec1cda8e24cd0a858a517d923c4f87b4be6e16a6d5aaed"));
var generateMatrijs = createServerFn({ method: "POST" }).validator((input) => matrijsInputSchema.parse(input)).handler(createSsrRpc("859099a41034fa6903e6d71973de3e68fd2554965b55c69e808c5ccb02a64094"));
async function leesBronBestand(file) {
	const name = file.name.toLowerCase();
	const type = file.type;
	if (name.endsWith(".docx") || type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
		const mammoth = await import("../_libs/mammoth+[...].mjs").then((n) => /* @__PURE__ */ __toESM(n.t()));
		const buf = await file.arrayBuffer();
		return (await mammoth.extractRawText({ arrayBuffer: buf })).value.trim();
	}
	return (await file.text()).trim();
}
//#endregion
export { leesBronBestand as i, generateMatrijs as n, generateToets as r, Textarea as t };
