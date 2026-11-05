import { describe, expect, it } from "vitest";
import { cutList, DEFAULT_DESIGNS, type Design, parts } from "../geometry";
import { en } from "../i18n/en";
import { fr } from "../i18n/fr";
import { formatLength, type Unit } from "../units/units";
import {
	axoLeaders,
	type PlanContext,
	pattern,
	planHtml as render,
} from "./plan";
import { esc } from "./svg";

const ROUND: Design = {
	edge: 300,
	width: 26.9,
	gap: 13.45,
	wall: 2.6,
	profile: { shape: "round", joint: "elbow", bendRadius: 40.35 },
};
const DESIGNS: [string, Design][] = [
	["square", DEFAULT_DESIGNS.metric],
	["round with elbows", ROUND],
	[
		"bent round",
		{
			...ROUND,
			profile: { shape: "round", joint: "bent", bendRadius: 40.35 },
		},
	],
];
const LANGUAGES = [
	["fr", fr],
	["en", en],
] as const;
const UNITS: Unit[] = ["mm", "in"];
const date = new Date("2026-11-03T12:00:00Z");

// The same plan is asked for by several tests: draw it once
const drawn = new Map<string, string>();
const planHtml = (design: Design, context: PlanContext): string => {
	const key = JSON.stringify([design, context.locale, context.unit]);
	const html = drawn.get(key) ?? render(design, context);
	drawn.set(key, html);
	return html;
};

const count = (html: string, pattern: RegExp) =>
	html.match(pattern)?.length ?? 0;

describe.each(DESIGNS)("plan, %s", (_, design) => {
	describe.each(LANGUAGES)("%s", (locale, messages) => {
		it.each(UNITS)("numbers every sheet in its title block, in %s", (unit) => {
			const html = planHtml(design, { locale, unit, messages, date });
			const pages = count(html, /class="lc-page"/g);
			expect(pages).toBeGreaterThanOrEqual(3);
			for (let page = 1; page <= pages; page++) {
				expect(html).toContain(`<b>${page}/${pages}</b>`);
			}
			expect(count(html, /class="lc-block"/g)).toBe(pages);
			expect(count(html, /class="lc-credit"/g)).toBe(pages);
			expect(html).toContain(messages.plan.standardName);
			expect(html).toContain(messages.plan.projectionName);
			expect(html).toContain("2026-11-03");
		});

		it("marks every piece in the axonometric view, as in the 3D view", () => {
			const html = planHtml(design, { locale, unit: "mm", messages, date });
			for (const mark of parts(design).flatMap((p) => p.marks)) {
				expect(html).toMatch(new RegExp(`font-weight="700">${mark}</text>`));
			}
		});

		it.each(UNITS)(
			"lists the stock in the bill of materials, in %s",
			(unit) => {
				const html = planHtml(design, { locale, unit, messages, date });
				const list = cutList(design);
				expect(html).toContain(esc(formatLength(list.total, unit, locale)));
				for (const item of list.items) {
					if (item.cut !== null) {
						expect(html).toContain(esc(formatLength(item.cut, unit, locale)));
					}
				}
			},
		);
	});
});

describe("drawing conventions", () => {
	it("dimension in mm without unit, or in fractions of an inch", () => {
		const metric = planHtml(DEFAULT_DESIGNS.metric, {
			locale: "fr",
			unit: "mm",
			messages: fr,
			date,
		});
		expect(metric).toContain(">G 12,5</text>");
		expect(metric).toContain(">262,5</text>");
		const imperial = planHtml(DEFAULT_DESIGNS.imperial, {
			locale: "en",
			unit: "in",
			messages: en,
			date,
		});
		expect(imperial).toContain(">G 1/2</text>");
		expect(imperial).toContain(">10-1/2</text>");
	});

	it("give one page to each sheet that the A4 holds", () => {
		const html = planHtml(DEFAULT_DESIGNS.metric, {
			locale: "fr",
			unit: "mm",
			messages: fr,
			date,
		});
		expect(count(html, /class="lc-card"/g)).toBe(3);
	});

	it("ask for a print at 100 % with a bar to check on every sheet", () => {
		const metric = planHtml(DEFAULT_DESIGNS.metric, {
			locale: "fr",
			unit: "mm",
			messages: fr,
			date,
		});
		const sheets = count(metric, /class="lc-page"/g);
		expect(count(metric, /class="lc-drawing lc-check"/g)).toBe(sheets);
		expect(metric).toContain(
			"Imprimer à 100 % · cette barre doit mesurer 100\u00a0mm",
		);
		expect(metric).toContain('height="102mm"');
		const imperial = planHtml(DEFAULT_DESIGNS.imperial, {
			locale: "en",
			unit: "in",
			messages: en,
			date,
		});
		expect(imperial).toContain(
			"Print at 100% scale · this bar must measure 4&quot;",
		);
		expect(imperial).toContain('height="103.6mm"');
	});

	it("mark the bent tube layout NTS in English", () => {
		const bent: Design = {
			...ROUND,
			profile: { shape: "round", joint: "bent", bendRadius: 40.35 },
		};
		expect(
			planHtml(bent, { locale: "en", unit: "in", messages: en, date }),
		).toContain("from end 1 (NTS)");
		expect(
			planHtml(bent, { locale: "fr", unit: "mm", messages: fr, date }),
		).toContain("depuis l'extrémité 1 (sans échelle)");
	});
});

describe("sheet 1", () => {
	const ELBOWS: Design = {
		...ROUND,
		profile: { shape: "round", joint: "elbow", bendRadius: 40.35 },
	};
	const BENT: Design = {
		...ROUND,
		profile: { shape: "round", joint: "bent", bendRadius: 40.35 },
	};
	const french = { locale: "fr", unit: "mm", messages: fr, date } as const;
	const english = { locale: "en", unit: "in", messages: en, date } as const;

	it.each([
		["square, fr", DEFAULT_DESIGNS.metric, french],
		["square, en", DEFAULT_DESIGNS.imperial, english],
		["elbows, fr", ELBOWS, french],
		["elbows, en", ELBOWS, english],
		["bent", BENT, french],
	] as const)(
		"ends every leader in its piece, crossing no other (%s)",
		(_, design, context) => {
			const leaders = axoLeaders(design, context);
			expect(leaders.filter((l) => !l.clear)).toEqual([]);
			expect(leaders).toHaveLength(
				1 + new Set(parts(design).flatMap((p) => p.marks)).size,
			);
		},
	);

	it("marks the identical elbows once, with C", () => {
		expect(
			axoLeaders(ELBOWS, french).filter((l) => l.mark.startsWith("C")),
		).toEqual([{ mark: "C", clear: true }]);
		const html = planHtml(ELBOWS, french);
		expect(html).toContain("C\u00a0: 18 coudes identiques, un à chaque angle.");
		expect(html).toContain("<td>C</td>");
		expect(planHtml(ELBOWS, english)).toContain(
			"C: 18 identical elbows, one at each corner.",
		);
	});

	it("details the doubled bars in section, with W, G and e", () => {
		const metric = planHtml(DEFAULT_DESIGNS.metric, french);
		expect(metric).toContain(">X</text>");
		expect(metric).toContain("Détail X, coupe (éch. 1:2)");
		for (const label of ["W 25", "G 12,5", "e 2"])
			expect(metric).toContain(`>${label}</text>`);
		const elbows = planHtml(ELBOWS, english);
		expect(elbows).toContain("Detail X, section (scale 1:2)");
		expect(elbows).toContain(">Ø 1-1/16</text>");
	});

	it("gives the loop sequence and its repeating pattern", () => {
		const nb = "\u00a0→ ";
		const square = planHtml(DEFAULT_DESIGNS.metric, french);
		expect(square).toContain(`A1${nb}B1${nb}A2${nb}A3${nb}C1${nb}A4`);
		expect(square).toContain(`A12${nb}A1</p>`);
		expect(square).toContain("3 × (A, B, A, A, C, A)");
		const elbows = planHtml(ELBOWS, french);
		expect(elbows).toContain(`A1${nb}C${nb}B1${nb}C${nb}A2`);
		expect(elbows).toContain("6 × (A, C, B, C, A, C)");
		expect(planHtml(BENT, english)).toContain("6 × A<");
	});

	it("finds the shortest repeating run", () => {
		expect(pattern(["A", "B", "A", "B"])).toEqual({
			count: 2,
			run: ["A", "B"],
		});
		expect(pattern(["A", "A", "A"])).toEqual({ count: 3, run: ["A"] });
		expect(pattern(["A", "B", "C"])).toBeNull();
	});

	it("calls out the butt welds with a weld symbol and the illusion in a diagonal view", () => {
		expect(planHtml(DEFAULT_DESIGNS.metric, french)).toContain(
			">18 angles</text>",
		);
		expect(planHtml(ELBOWS, english)).toContain(">36 joints</text>");
		expect(planHtml(BENT, french)).toContain(">6 raboutages</text>");
		expect(planHtml(DEFAULT_DESIGNS.metric, french)).toContain(
			"Vue diagonale (sans échelle)",
		);
		expect(planHtml(DEFAULT_DESIGNS.imperial, english)).toContain(
			"Diagonal view (not to scale)",
		);
	});
});

describe("notes and cut cards", () => {
	const ELBOWS: Design = {
		...ROUND,
		profile: { shape: "round", joint: "elbow", bendRadius: 40.35 },
	};
	const BENT: Design = {
		...ROUND,
		profile: { shape: "round", joint: "bent", bendRadius: 40.35 },
	};
	const french = { locale: "fr", unit: "mm", messages: fr, date } as const;
	const english = { locale: "en", unit: "in", messages: en, date } as const;

	it("keeps the cut length as the dimension, the others in parentheses", () => {
		const metric = planHtml(DEFAULT_DESIGNS.metric, french);
		expect(metric).toContain(">262,5</text>");
		expect(metric).toContain(">(L 237,5)</text>");
		expect(metric).toContain(">(212,5)</text>");
		expect(metric).toContain(
			"Cotes entre parenthèses\u00a0: cotes auxiliaires",
		);
		const imperial = planHtml(DEFAULT_DESIGNS.imperial, english);
		expect(imperial).toContain(">10-1/2</text>");
		expect(imperial).toContain(">(L 9-1/2)</text>");
		expect(imperial).toContain("reference dimensions");
	});

	it("draws the tube wall in end views on their own scale", () => {
		const square = planHtml(DEFAULT_DESIGNS.metric, french);
		const sheets = count(square, /class="lc-page"/g);
		// The projection symbol of each title block, and the bore of the 3 bars
		expect(count(square, /<polygon class="thick"/g)).toBe(sheets + 3);
		expect(count(square, />Éch\. 1:1<\/text>/g)).toBe(3);
		// Ø 26.9 × 2.6 at 1:1
		const elbows = planHtml(ELBOWS, french);
		expect(elbows).toContain('r="13.45"');
		expect(elbows).toContain('r="10.85"');
		expect(elbows).toContain(">Éch. 1:1</text>");
	});

	it("say how G is measured, that errors add up and that grinding is optional", () => {
		const square = planHtml(DEFAULT_DESIGNS.metric, french);
		expect(square).toContain(
			"G\u00a0: jeu entre deux barres parallèles voisines, mesuré perpendiculairement à une face du cube",
		);
		expect(square).toContain("les écarts des 18 soudures se cumulent");
		expect(square).toContain("Soudures meulées à ras");
		expect(square).toContain("côté court (intérieur de l'angle)");
		expect(planHtml(ELBOWS, french)).toContain("les écarts des 36 soudures");
		expect(planHtml(BENT, french)).toContain(
			"les écarts des 18 cintres et des 6 soudures",
		);
		const imperial = planHtml(DEFAULT_DESIGNS.imperial, english);
		expect(imperial).toContain("measured perpendicular to a cube face");
		expect(imperial).toContain("the errors of the 18 welds add up");
		expect(imperial).toContain("Welds ground flush");
	});
});
