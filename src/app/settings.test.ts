import { describe, expect, it } from "vitest";
import { DEFAULT_DESIGNS } from "../geometry";
import {
	defaultSettings,
	fieldsOf,
	fromDisplay,
	issuesOf,
	limitReached,
	paramValue,
	type Settings,
	sliderRange,
	toDesign,
	typedRange,
	withPattern,
	withShape,
	withUnit,
	withValue,
} from "./settings";

const START: [string, Settings][] = [
	["metric square", defaultSettings("mm")],
	["imperial square", defaultSettings("in")],
	["metric round with elbows", defaultSettings("mm", "round")],
	["imperial bent round", defaultSettings("in", "round", "bent")],
	[
		"small bent cube, gap and radius set",
		{
			...defaultSettings("mm", "round", "bent"),
			edge: 220,
			gap: 8,
			bendRadius: 30,
		},
	],
	["metric box", withPattern(defaultSettings("mm"), "box")],
	[
		"imperial bent framed cube",
		withPattern(defaultSettings("in", "round", "bent"), "framed"),
	],
	[
		"long bent box with elbows",
		{
			...withPattern(defaultSettings("mm", "round"), "box"),
			edge: 450,
			length: 1200,
		},
	],
];

describe("default settings", () => {
	it("are the designs of the spec", () => {
		expect(toDesign(defaultSettings("mm"))).toEqual(DEFAULT_DESIGNS.metric);
		expect(toDesign(defaultSettings("in"))).toEqual(DEFAULT_DESIGNS.imperial);
	});

	it.each(START)("are valid: %s", (_, s) => {
		expect(issuesOf(s)).toEqual([]);
	});
});

describe.each(START)("sliders, %s", (_, s) => {
	it("contain the current value, on the step grid", () => {
		for (const p of fieldsOf(s)) {
			const r = sliderRange(s, p);
			expect(r.min).toBeLessThanOrEqual(r.value + 1e-9);
			expect(r.max).toBeGreaterThanOrEqual(r.value - 1e-9);
			expect((r.max - r.min) / r.step).toBeCloseTo(
				Math.round((r.max - r.min) / r.step),
				6,
			);
		}
	});

	it("only reach valid designs", () => {
		for (const p of fieldsOf(s)) {
			const r = sliderRange(s, p);
			for (const k of [0, 0.25, 0.5, 0.75, 1]) {
				const v = r.min + Math.round(((r.max - r.min) / r.step) * k) * r.step;
				const next = withValue(s, p, fromDisplay(v, s.unit));
				expect(issuesOf(next), `${p} = ${v}`).toEqual([]);
			}
		}
	});

	it("never go below what a typed value may reach", () => {
		for (const p of fieldsOf(s)) {
			const r = sliderRange(s, p);
			const min = fromDisplay(r.min, s.unit);
			expect(min).toBeGreaterThanOrEqual(typedRange(s, p).min - 1e-9);
		}
	});
});

describe("slider limits", () => {
	const metric = defaultSettings("mm");
	const round = defaultSettings("mm", "round");
	const atMin = (s: Settings, p: "edge" | "bendRadius") =>
		withValue(s, p, fromDisplay(sliderRange(s, p).min, s.unit));
	const atMax = (s: Settings, p: "width" | "wall" | "gap") =>
		withValue(s, p, fromDisplay(sliderRange(s, p).max, s.unit));

	it("say nothing away from the limits", () => {
		for (const p of fieldsOf(round)) {
			expect(limitReached(sliderRange(round, p))).toBeNull();
		}
	});

	it("stop the edge at the shortest straight run", () => {
		expect(limitReached(sliderRange(atMin(metric, "edge"), "edge"))).toBe(
			"straight",
		);
		expect(limitReached(sliderRange(atMax(metric, "gap"), "gap"))).toBe(
			"straight",
		);
	});

	it("stop the wall at a solid bar", () => {
		expect(limitReached(sliderRange(atMax(metric, "wall"), "wall"))).toBe(
			"solid",
		);
	});

	it("stop the radius at one diameter", () => {
		expect(
			limitReached(sliderRange(atMin(round, "bendRadius"), "bendRadius")),
		).toBe("radius");
	});

	it("stop the width at the radius once the radius is set", () => {
		const s = { ...round, edge: 1000, bendRadius: 30 };
		expect(sliderRange(s, "width").max).toBe(30);
		expect(limitReached(sliderRange(atMax(s, "width"), "width"))).toBe(
			"radius",
		);
	});
});

describe("box", () => {
	const box = withPattern(defaultSettings("mm"), "box");
	const bound = (p: "depth" | "length", end: "min" | "max") =>
		withValue(box, p, fromDisplay(sliderRange(box, p)[end], box.unit));

	it("starts as deep as high, twice as long, and shows its length and depth", () => {
		expect([box.edge, box.depth, box.length]).toEqual([300, 300, 600]);
		expect(fieldsOf(box)).toEqual(expect.arrayContaining(["length", "depth"]));
		expect(fieldsOf(defaultSettings("mm"))).not.toContain("length");
		expect(fieldsOf(defaultSettings("mm"))).not.toContain("depth");
		expect(toDesign(box).pattern).toEqual({
			kind: "box",
			length: 600,
			depth: 300,
		});
	});

	it("starts from the cube edge, and gets longer when that is larger than its length", () => {
		const large = withValue(defaultSettings("mm"), "edge", 800);
		expect(withPattern(large, "box").depth).toBe(800);
		expect(withPattern(large, "box").length).toBe(1600);
		expect(withPattern(large, "framed").length).toBe(600);
	});

	it("keeps its depth while it stays a box", () => {
		const deep = withValue(box, "depth", 450);
		expect(withPattern(deep, "box")).toEqual(deep);
		expect(withValue(deep, "edge", 200).depth).toBe(450);
	});

	it("sets its height apart, and stops the depth at the length and the length at the depth", () => {
		expect(sliderRange(box, "edge").max).toBe(1500);
		expect(sliderRange(box, "depth").max).toBe(600);
		expect(limitReached(sliderRange(bound("depth", "max"), "depth"))).toBe(
			"length",
		);
		expect(sliderRange(box, "length").min).toBe(300);
		expect(limitReached(sliderRange(bound("length", "min"), "length"))).toBe(
			"length",
		);
	});

	it("keeps its shape when the unit changes", () => {
		expect(withUnit(box, "in")).toEqual(
			withPattern(defaultSettings("in"), "box"),
		);
		expect(withUnit(box, "in").length).toBeCloseTo(24 * 25.4, 9);
	});
});

describe("profile and unit changes", () => {
	it("switch to the closest standard round tube", () => {
		const s = withShape(defaultSettings("mm"), "round");
		expect([s.width, s.wall]).toEqual([26.9, 2.6]);
		expect(s).toEqual(defaultSettings("mm", "round"));
	});

	it("give untouched dimensions the defaults of the new unit", () => {
		expect(withUnit(defaultSettings("mm"), "in")).toEqual(
			defaultSettings("in"),
		);
		expect(withUnit(defaultSettings("in", "round", "bent"), "mm")).toEqual(
			defaultSettings("mm", "round", "bent"),
		);
	});

	it("keep edited dimensions", () => {
		const s = withUnit({ ...defaultSettings("mm"), edge: 400 }, "in");
		expect([s.unit, s.edge, s.width]).toEqual(["in", 400, 25]);
	});

	it("let the gap and the radius follow the width until they are set", () => {
		const wide = withValue(defaultSettings("mm", "round"), "width", 33.7);
		expect(paramValue(wide, "gap")).toBeCloseTo(33.7 / 2, 9);
		expect(paramValue(wide, "bendRadius")).toBeCloseTo(33.7 * 1.5, 9);
		const fixed = withValue(withValue(wide, "gap", 10), "width", 26.9);
		expect(paramValue(fixed, "gap")).toBe(10);
		expect(paramValue(withValue(fixed, "gap", null), "gap")).toBe(26.9 / 2);
	});
});
