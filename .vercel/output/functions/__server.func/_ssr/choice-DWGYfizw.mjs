import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as cn } from "./app-shell-BwgW9Zae.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/choice-DWGYfizw.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var fieldClassName = "flex h-12 w-full rounded-[var(--radius-md)] border border-transparent bg-paper px-4 text-base text-fg transition-[box-shadow,border-color] duration-[var(--motion-quick)] ease-[var(--ease-out)] placeholder:text-muted/70 focus-visible:border-brand/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50 md:text-sm";
var Input = import_react.forwardRef(({ className, type, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
	type,
	className: cn(fieldClassName, className),
	ref,
	...props
}));
Input.displayName = "Input";
var Label = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
	ref,
	className: cn("text-sm font-semibold text-brand leading-none peer-disabled:opacity-50", className),
	...props
}));
Label.displayName = "Label";
function Choice({ value, onChange, options, legend, hint }) {
	const selected = options.find((o) => o.id === value);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", {
		className: "grid gap-2",
		children: [
			legend ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", {
				className: "text-sm font-semibold text-brand",
				children: legend
			}) : null,
			hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: hint
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex min-w-0 rounded-[var(--radius-lg)] bg-paper p-1",
				children: options.map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					"aria-pressed": value === o.id,
					onClick: () => onChange(o.id),
					className: cn("min-h-11 min-w-0 flex-1 rounded-[var(--radius-md)] px-2 text-sm transition-[background-color,color] duration-[var(--motion-quick)] ease-[var(--ease-out)]", value === o.id ? "bg-brand font-semibold text-paper" : "text-muted hover:text-brand"),
					children: o.label
				}, o.id))
			}),
			selected?.hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: selected.hint
			}) : null
		]
	});
}
//#endregion
export { fieldClassName as i, Input as n, Label as r, Choice as t };
