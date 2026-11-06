import {
	findSection,
	STANDARD_SIZES,
	type StandardSize,
	type Wall,
} from "../catalog/sections";
import {
	type Issue,
	MIN_STRAIGHT,
	type ParamName,
	type PatternKind,
	type ProfileShape,
} from "../geometry";
import type { Messages } from "../i18n/fr";
import { fill } from "../i18n/template";
import {
	formatField,
	formatLength,
	formatMeasure,
	formatSection,
	parseLength,
	type Unit,
} from "../units/units";
import {
	FIELD_SPECS,
	FIELDS,
	fieldsOf,
	fromDisplay,
	issuesOf,
	type Joint,
	limitReached,
	paramValue,
	type Settings,
	sliderRange,
	snapToStep,
	typedRange,
	withPattern,
	withSection,
	withShape,
	withUnit,
	withValue,
} from "./settings";

export type FormMessages = Pick<
	Messages,
	"ui" | "params" | "issues" | "limits"
>;

export interface FormOptions {
	locale: string;
	messages: FormMessages;
	settings: Settings;
	onChange: (settings: Settings) => void;
}

interface Field {
	label: HTMLElement;
	text: HTMLInputElement;
	range: HTMLInputElement;
	suffix: HTMLElement;
	message: HTMLElement;
	auto: HTMLInputElement | null;
	autoLabel: HTMLElement | null;
}

const EPS = 1e-6;

export function createForm(form: HTMLFormElement, options: FormOptions): void {
	const { locale, messages: m } = options;
	let s = options.settings;
	const errors = new Map<ParamName, string>();
	/** Last field moved or typed in: the only one whose limit gets explained */
	let active: ParamName | null = null;

	const get = <T extends HTMLElement>(selector: string): T => {
		const element = form.querySelector<T>(selector);
		if (!element) throw new Error(`Missing ${selector}`);
		return element;
	};
	const radios = (name: string) => [
		...form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`),
	];
	const pattern = get<HTMLSelectElement>("#lc-pattern");
	const section = get<HTMLSelectElement>("#lc-section");
	const hints = {
		pattern: get("#lc-pattern-hint"),
		shape: get("#lc-shape-hint"),
		joint: get("#lc-joint-hint"),
		section: get("#lc-section-hint"),
	};
	const roundOnly = [...form.querySelectorAll<HTMLElement>("[data-round]")];
	const boxOnly = [...form.querySelectorAll<HTMLElement>("[data-box]")];
	const fields = Object.fromEntries(
		FIELDS.map((p): [ParamName, Field] => [
			p,
			{
				label: get(`#lc-${p}-label`),
				text: get(`#lc-${p}`),
				range: get(`#lc-${p}-range`),
				suffix: get(`#lc-${p}-suffix`),
				message: get(`#lc-${p}-msg`),
				auto: form.querySelector(`#lc-${p}-auto`),
				autoLabel: form.querySelector(`#lc-${p}-auto-label`),
			},
		]),
	) as Record<ParamName, Field>;

	const measureOf = (p: ParamName) => FIELD_SPECS[p].measure;
	const show = (mm: number, p: ParamName) =>
		formatMeasure(mm, s.unit, locale, measureOf(p));
	const paramLabel = (p: ParamName) =>
		p === "width"
			? m.ui.width[s.shape]
			: p === "edge"
				? m.ui.edge[s.pattern]
				: m.params[p];
	const issueText = (issue: Issue) => {
		const direction = issue.code === "wallTooThick" ? "down" : "up";
		const limit =
			issue.limit === undefined
				? ""
				: show(
						snapToStep(issue.limit, issue.param, s.unit, direction),
						issue.param,
					);
		return fill(m.issues[issue.code], {
			param: paramLabel(issue.param),
			limit,
		});
	};
	const sectionName = (size: StandardSize, wall: Wall) =>
		[
			size.name,
			formatSection(s.shape, size.width, wall.value, s.unit, locale),
			wall.name,
		]
			.filter(Boolean)
			.join(" · ");

	// Many input events can fire per frame: render and notify once per frame.
	let frame = 0;
	let changed = false;
	const schedule = (stateChanged: boolean) => {
		changed ||= stateChanged;
		if (frame) return;
		frame = requestAnimationFrame(() => {
			frame = 0;
			render();
			if (changed) {
				changed = false;
				options.onChange(s);
			}
		});
	};
	const update = (next: Settings) => {
		s = next;
		errors.clear();
		schedule(true);
	};
	const reject = (p: ParamName, reason: string) => {
		errors.clear();
		errors.set(p, reason);
		schedule(false);
	};

	function commit(p: ParamName, text: string) {
		const mm = parseLength(text, s.unit);
		if (mm === null) {
			const example = formatField(
				paramValue(s, p),
				s.unit,
				locale,
				measureOf(p),
			);
			reject(p, fill(m.ui.notANumber, { example }));
			return;
		}
		const next = withValue(s, p, mm);
		const range = typedRange(s, p);
		const issues = issuesOf(next);
		if (issues.length === 0 && mm >= range.min - EPS) {
			update(next);
			return;
		}
		const min = show(snapToStep(range.min, p, s.unit, "up"), p);
		const possible = Number.isFinite(range.max)
			? fill(m.ui.range, {
					min,
					max: show(snapToStep(range.max, p, s.unit, "down"), p),
				})
			: fill(m.ui.rangeFrom, { min });
		reject(p, [...issues.map(issueText), possible].join(" "));
	}

	function renderChoice<T extends string>(
		name: string,
		current: T,
		labels: Record<T, string>,
		candidate: (value: T) => Settings,
	): string {
		const blocked: string[] = [];
		for (const radio of radios(name)) {
			const value = radio.value as T;
			radio.checked = value === current;
			const [issue] = value === current ? [] : issuesOf(candidate(value));
			radio.disabled = issue !== undefined;
			if (issue) {
				blocked.push(
					fill(m.ui.blocked, {
						option: labels[value],
						reason: issueText(issue),
					}),
				);
			}
		}
		return blocked.join(" ");
	}

	let sectionsShown = "";
	function renderSections() {
		const sizes = STANDARD_SIZES[s.unit][s.shape];
		const key = `${s.unit}|${s.shape}`;
		if (key !== sectionsShown) {
			sectionsShown = key;
			const custom = new Option(m.ui.custom, "");
			custom.disabled = true;
			section.replaceChildren(
				custom,
				...sizes.flatMap((size, i) =>
					size.walls.map(
						(wall, j) => new Option(sectionName(size, wall), `${i}:${j}`),
					),
				),
			);
		}
		const match = findSection(s.unit, s.shape, s.width, s.wall);
		const selected = match ? `${match.size}:${match.wall}` : "";
		let blocked = false;
		for (const option of section.options) {
			if (!option.value || option.value === selected) continue;
			const [i = -1, j = -1] = option.value.split(":").map(Number);
			const size = sizes[i];
			const wall = size?.walls[j];
			option.disabled =
				!size || !wall || issuesOf(withSection(s, size, wall.value)).length > 0;
			blocked ||= option.disabled;
		}
		section.value = selected;
		hints.section.textContent = blocked ? m.ui.sizesBlocked : "";
	}

	function renderField(p: ParamName) {
		const f = fields[p];
		const r = sliderRange(s, p);
		const mm = paramValue(s, p);
		f.range.min = String(r.min);
		f.range.max = String(r.max);
		f.range.step = String(r.step);
		if (document.activeElement !== f.range) f.range.value = String(r.value);
		f.range.disabled = r.min === r.max;
		f.range.setAttribute("aria-valuetext", show(mm, p));
		f.label.textContent = paramLabel(p);
		f.suffix.textContent = s.unit === "mm" ? "mm" : "in";
		f.text.inputMode = s.unit === "mm" ? "decimal" : "text";

		const error = errors.get(p);
		f.text.setAttribute("aria-invalid", String(error !== undefined));
		if (error === undefined) {
			f.text.value = formatField(mm, s.unit, locale, measureOf(p));
		}
		const limit = p === active ? limitReached(r) : null;
		f.message.textContent =
			error ??
			(limit
				? fill(m.limits[limit], {
						min: formatLength(MIN_STRAIGHT, s.unit, locale),
					})
				: "");
		f.message.classList.toggle("error", error !== undefined);

		if (f.auto) {
			const linked = (p === "gap" ? s.gap : s.bendRadius) === null;
			f.auto.checked = linked;
			f.auto.disabled = !linked && issuesOf(withValue(s, p, null)).length > 0;
		}
		if (f.autoLabel) {
			f.autoLabel.textContent =
				p === "gap" ? m.ui.gapAuto[s.shape] : m.ui.radiusAuto;
		}
	}

	function render() {
		for (const radio of radios("unit")) radio.checked = radio.value === s.unit;
		pattern.value = s.pattern;
		hints.pattern.textContent = m.ui.patternHints[s.pattern];
		for (const element of boxOnly) element.hidden = s.pattern !== "box";
		hints.shape.textContent = renderChoice("shape", s.shape, m.ui.shapes, (v) =>
			withShape(s, v),
		);
		for (const element of roundOnly) element.hidden = s.shape !== "round";
		hints.joint.textContent = renderChoice(
			"joint",
			s.joint,
			m.ui.joints,
			(v) => ({
				...s,
				joint: v,
			}),
		);
		renderSections();
		for (const p of fieldsOf(s)) renderField(p);
	}

	form.addEventListener("submit", (event) => event.preventDefault());
	form.addEventListener("input", (event) => {
		const target = event.target;
		if (!(target instanceof HTMLInputElement) || target.type !== "range")
			return;
		const p = target.getAttribute("data-param") as ParamName;
		active = p;
		update(withValue(s, p, fromDisplay(target.valueAsNumber, s.unit)));
	});
	form.addEventListener("change", (event) => {
		const target = event.target;
		if (target === pattern) {
			active = null;
			update(withPattern(s, pattern.value as PatternKind));
			return;
		}
		if (target === section) {
			active = null;
			const [i = -1, j = -1] = section.value.split(":").map(Number);
			const size = STANDARD_SIZES[s.unit][s.shape][i];
			const wall = size?.walls[j];
			if (size && wall) update(withSection(s, size, wall.value));
			return;
		}
		if (!(target instanceof HTMLInputElement)) return;
		const p = target.getAttribute("data-param") as ParamName | null;
		if (target.type !== "range") active = target.name === "value" ? p : null;
		switch (target.name) {
			case "unit":
				update(withUnit(s, target.value as Unit));
				break;
			case "shape":
				update(withShape(s, target.value as ProfileShape));
				break;
			case "joint":
				update({ ...s, joint: target.value as Joint });
				break;
			case "auto":
				if (p)
					update(withValue(s, p, target.checked ? null : paramValue(s, p)));
				break;
			case "value":
				if (p) commit(p, target.value);
				break;
		}
	});

	render();
}
