import { type Design, type Part, parts, quantity } from "../geometry";
import type { Messages } from "../i18n/fr";
import { fill } from "../i18n/template";
import { formatLength, type Unit } from "../units/units";
import { METAL, partColor } from "../viewer/palette";
import type { ViewOptions } from "../viewer/viewer";

export interface LegendContext {
	unit: Unit;
	locale: string;
	messages: Pick<Messages, "parts">;
}

function describe(part: Part, { unit, locale, messages }: LegendContext) {
	const m = messages.parts;
	const length = (mm: number) => formatLength(mm, unit, locale);
	switch (part.kind) {
		case "bar": {
			const ends =
				part.relation === "twisted"
					? part.chirality > 0
						? "right"
						: "left"
					: part.relation;
			return [m.bar[ends], fill(m.axis, { length: length(part.length) })];
		}
		case "tube":
			return [m.tube, length(part.length)];
		case "elbow":
			return [m.elbow, fill(m.radius, { radius: length(part.radius) })];
		case "section":
			return [
				fill(m.section, { bends: part.straights.length - 1 }),
				fill(m.developed, { length: length(part.length) }),
			];
	}
}

export function renderLegend(
	list: HTMLElement,
	design: Design,
	options: ViewOptions,
	context: LegendContext,
): void {
	list.hidden = !options.colors && options.marks === "none";
	if (list.hidden) return;
	list.replaceChildren(
		...parts(design).map((part, index) => {
			const item = document.createElement("li");
			const swatch = document.createElement("span");
			swatch.className = "swatch";
			swatch.style.background = options.colors ? partColor(index) : METAL;
			const mark = document.createElement("b");
			mark.textContent = part.id;
			const details = document.createElement("span");
			details.className = "details";
			details.textContent = describe(part, context).join(" · ");
			item.append(swatch, mark, ` ×${quantity(part)} `, details);
			return item;
		}),
	);
}
