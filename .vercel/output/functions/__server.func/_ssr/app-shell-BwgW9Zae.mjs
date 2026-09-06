import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime, v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as clsx, t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { t as Slot } from "../_libs/radix-ui__react-slot.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/app-shell-BwgW9Zae.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
var buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap font-bold transition-[opacity,transform,background-color,color] duration-[var(--motion-quick)] ease-[var(--ease-out)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-40 active:not-disabled:scale-[0.98] [&_svg]:size-4 [&_svg]:shrink-0", {
	variants: {
		variant: {
			default: "bg-primary text-primary-fg hover:opacity-90",
			secondary: "bg-surface text-brand hover:opacity-90",
			outline: "bg-transparent text-brand ring-1 ring-border hover:bg-surface",
			ghost: "text-muted hover:text-brand hover:bg-surface",
			ink: "bg-brand text-paper hover:opacity-90"
		},
		size: {
			default: "h-12 rounded-[var(--radius-lg)] px-5 text-sm",
			sm: "h-11 rounded-[var(--radius-md)] px-4 text-sm",
			lg: "h-14 rounded-[var(--radius-lg)] px-6 text-base",
			icon: "size-11 rounded-[var(--radius-md)]"
		}
	},
	defaultVariants: {
		variant: "default",
		size: "default"
	}
});
var Button = import_react.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(asChild ? Slot : "button", {
		className: cn(buttonVariants({
			variant,
			size
		}), className),
		ref,
		...props
	});
});
Button.displayName = "Button";
function LeafMark({ className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
		viewBox: "0 0 32 32",
		fill: "none",
		"aria-hidden": "true",
		className,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
			fill: "currentColor",
			d: "M8.2 19.2c.2-7.2 6.4-13.6 14.8-15 1.2 7.6-2.6 15.4-10.4 19.2-2.4 1.2-4.6-.4-4.4-4.2Z"
		})
	});
}
var TABS = [
	{
		to: "/",
		label: "Toets maken",
		exact: true
	},
	{
		to: "/cijfer",
		label: "Cijfer berekenen"
	},
	{
		to: "/matrijsmaker",
		label: "Matrijsmaker"
	}
];
function AppShell({ children, printHidden }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-dvh bg-bg text-fg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
				href: "#inhoud",
				className: "sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-[var(--radius-md)] focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-fg",
				children: "Naar inhoud"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: cn("sticky top-0 z-40 bg-bg", printHidden && "print:hidden"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto max-w-3xl px-5 sm:px-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex h-14 items-center sm:h-16",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/",
							className: "flex min-w-0 items-center gap-2.5 text-brand",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LeafMark, { className: "size-8 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "truncate text-xl tracking-tight",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-bold",
										children: "Aeres"
									}),
									" ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-medium",
										children: "Toetsmaker"
									})
								]
							})]
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
						"aria-label": "Hoofdmenu",
						className: "grid grid-cols-3 gap-1 rounded-[var(--radius-lg)] bg-surface p-1",
						children: TABS.map((tab) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NavItem, {
							to: tab.to,
							exact: "exact" in tab && tab.exact,
							children: tab.label
						}, tab.to))
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-3" })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				id: "inhoud",
				children
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("footer", {
				className: cn("mx-auto max-w-3xl px-5 pb-10 pt-2 sm:px-6", printHidden && "print:hidden"),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-sm leading-relaxed text-muted",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/werkwijze",
							className: "font-semibold text-brand hover:opacity-80",
							children: "Werkwijze"
						}),
						" · ",
						"Constructiehulp · docent controleert altijd inhoud en cesuur."
					]
				})
			})
		]
	});
}
function NavItem({ to, children, exact }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
		to,
		activeOptions: exact ? { exact: true } : void 0,
		className: "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] px-2 text-center text-sm leading-tight text-brand/70 hover:text-brand",
		activeProps: { className: "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-brand px-2 text-center text-sm font-semibold leading-tight text-paper" },
		children
	});
}
function Page({ children, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: cn("mx-auto min-w-0 max-w-3xl overflow-x-clip px-5 py-8 sm:px-6 sm:py-10", className),
		children
	});
}
function PageIntro({ title, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
		className: "mb-6",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "text-3xl font-bold tracking-tight text-brand sm:text-4xl",
			children: title
		}), children ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-3 max-w-xl text-pretty leading-relaxed text-muted",
			children
		}) : null]
	});
}
//#endregion
export { PageIntro as a, Page as i, Button as n, cn as o, LeafMark as r, AppShell as t };
