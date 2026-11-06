import type { Messages } from "../i18n/fr";
import type { Unit } from "../units/units";
import type { MarkDisplay } from "../viewer/model";
import type { Viewer, ViewOptions } from "../viewer/viewer";
import { track } from "./analytics";
import { createForm } from "./form";
import { renderLegend } from "./legend";
import { defaultSettings, type Settings, toDesign } from "./settings";

export interface ClientConfig {
	locale: string;
	/** Unit of the page language, until the user picks another one */
	unit: Unit;
	messages: Pick<
		Messages,
		"ui" | "params" | "issues" | "limits" | "viewer" | "parts" | "plan"
	>;
}

const UNIT_KEY = "loopcube:unit";

function storedUnit(): Unit | null {
	try {
		const unit = localStorage.getItem(UNIT_KEY);
		return unit === "mm" || unit === "in" ? unit : null;
	} catch {
		return null;
	}
}

function storeUnit(unit: Unit): void {
	try {
		localStorage.setItem(UNIT_KEY, unit);
	} catch {}
}

/**
 * Resolves once the page has loaded, the viewer is near the screen and the
 * browser is idle, so that the 3D library never competes with the first paint.
 */
async function whenNeeded(target: Element): Promise<void> {
	if (document.readyState !== "complete") {
		await new Promise((resolve) => {
			addEventListener("load", resolve, { once: true });
		});
	}
	await new Promise<void>((resolve) => {
		const observer = new IntersectionObserver(
			(entries) => {
				if (!entries.some((e) => e.isIntersecting)) return;
				observer.disconnect();
				resolve();
			},
			{ rootMargin: "200px" },
		);
		observer.observe(target);
	});
	await new Promise((resolve) => {
		if (typeof requestIdleCallback === "function") {
			requestIdleCallback(resolve, { timeout: 2000 });
		} else {
			setTimeout(resolve, 200);
		}
	});
}

export function start(): void {
	const get = <T extends HTMLElement>(id: string): T => {
		const element = document.getElementById(id);
		if (!element) throw new Error(`Missing #${id}`);
		return element as T;
	};
	const config = JSON.parse(get("lc-config").textContent ?? "") as ClientConfig;
	const { locale, messages } = config;
	const stage = get("lc-stage");
	const status = get("lc-status");
	const legend = get("lc-legend");
	const colors = get<HTMLInputElement>("lc-colors");
	const marks = get<HTMLSelectElement>("lc-marks");
	const human = get<HTMLInputElement>("lc-human");
	const diagonal = get<HTMLButtonElement>("lc-diagonal");
	const print = get<HTMLButtonElement>("lc-print");

	let settings = defaultSettings(storedUnit() ?? config.unit);
	let viewer: Viewer | null = null;
	/** Settings changed while the viewer was starting */
	let stale = false;
	const viewOptions = (): ViewOptions => ({
		colors: colors.checked,
		marks: marks.value as MarkDisplay,
		human: human.checked,
	});

	const plan = createPlan(() => settings, config);
	// The form only notifies real edits, never its initial state: one use per page load
	let used = false;
	/** Set by the print button, so that beforeprint tells it from the browser's own command */
	let printButton = false;

	const refresh = () => {
		plan.invalidate();
		const design = toDesign(settings);
		renderLegend(legend, design, viewOptions(), {
			unit: settings.unit,
			locale,
			messages,
		});
		if (viewer) viewer.update(design, viewOptions());
		else stale = true;
	};

	createForm(get("lc-params"), {
		locale,
		messages,
		settings,
		onChange(next) {
			if (!used) {
				used = true;
				track("configurator-use");
			}
			if (next.unit !== settings.unit) {
				storeUnit(next.unit);
				track("unit-change", { unit: next.unit });
			}
			settings = next;
			refresh();
		},
	});
	for (const [option, input] of [
		["colors", colors],
		["marks", marks],
		["human", human],
	] as const) {
		input.addEventListener("change", () => {
			refresh();
			track("view-option", {
				option,
				value: input instanceof HTMLInputElement ? input.checked : input.value,
			});
		});
	}
	diagonal.addEventListener("click", () => {
		viewer?.diagonalView();
		track("diagonal-view");
	});
	print.addEventListener("click", () => {
		print.disabled = true;
		plan
			.ready()
			.then(() => {
				plan.render();
				print.disabled = false;
				printButton = true;
				window.print();
			})
			.catch(() => {
				print.disabled = false;
			});
	});
	addEventListener("beforeprint", () => {
		plan.render();
		track("plan-print", {
			unit: settings.unit,
			pattern: settings.pattern,
			profile:
				settings.shape === "round" ? `round-${settings.joint}` : "square",
			method: printButton ? "button" : "browser",
		});
		printButton = false;
	});
	refresh();

	whenNeeded(stage)
		.then(() => import("../viewer/viewer"))
		.then(({ createViewer }) => {
			stale = false;
			return createViewer(stage, toDesign(settings), viewOptions());
		})
		.then((created) => {
			viewer = created;
			status.hidden = true;
			diagonal.disabled = false;
			if (stale) refresh();
		})
		.catch(() => {
			status.textContent = messages.viewer.unavailable;
		})
		// Loaded ahead of time so that the browser's own print command prints the plan
		.finally(() => plan.ready().catch(() => {}));
}

interface Plan {
	ready(): Promise<void>;
	render(): void;
	invalidate(): void;
}

function createPlan(current: () => Settings, config: ClientConfig): Plan {
	let module: Promise<typeof import("../plan/plan")> | null = null;
	let planHtml: typeof import("../plan/plan")["planHtml"] | null = null;
	let fresh = false;
	const root = document.createElement("div");
	root.className = "lc-plan";
	document.body.append(root);
	const title = document.title;
	addEventListener("afterprint", () => {
		document.title = title;
	});
	return {
		ready() {
			module ??= import("../plan/plan");
			return module.then((m) => {
				planHtml = m.planHtml;
			});
		},
		render() {
			if (!planHtml) return;
			const settings = current();
			if (!fresh) {
				root.innerHTML = planHtml(toDesign(settings), {
					locale: config.locale,
					unit: settings.unit,
					messages: config.messages,
					date: new Date(),
				});
				fresh = true;
				document.body.classList.add("lc-plan-ready");
			}
			// Default file name of a PDF export
			document.title = config.messages.plan.file;
		},
		invalidate() {
			fresh = false;
		},
	};
}
