import { describe, expect, it } from "vitest";
import {
	axisLengths,
	buildLoop,
	cutList,
	DEFAULT_DESIGNS,
	type Design,
	defaultBendRadius,
	mitreLengths,
	type SectionPart,
	sectionLayout,
} from "./index";

const round = (
	joint: "elbow" | "bent",
	bendRadius = defaultBendRadius(26.9),
): Design => ({
	edge: 300,
	width: 26.9,
	gap: 13.45,
	wall: 2.6,
	profile: { shape: "round", joint, bendRadius },
	pattern: { kind: "cube" },
});

const cuts = (d: Design) =>
	cutList(d).items.map((i) => [i.part.id, i.quantity, i.cut, i.total]);

describe("cut list, mitred square bars", () => {
	it("cuts 12 × 262.5 and 6 × 225 tip to tip for the metric defaults", () => {
		expect(cuts(DEFAULT_DESIGNS.metric)).toEqual([
			["A", 12, 262.5, 3150],
			["B", 3, 225, 675],
			["C", 3, 225, 675],
		]);
		expect(cutList(DEFAULT_DESIGNS.metric).total).toBe(4500);
	});

	it("gives L + W tip to tip and L − W inside for the spec example 300/25/12", () => {
		const d: Design = { ...DEFAULT_DESIGNS.metric, gap: 12 };
		const loop = buildLoop(d);
		const { long, short } = axisLengths(d);
		for (const s of loop.segments) {
			const l = mitreLengths(loop, s.index);
			const axis = s.length > short + 1e-9 ? long : short;
			expect(l.axis).toBeCloseTo(axis, 9);
			expect(l.outside).toBeCloseTo(axis + 25, 9);
			expect(l.inside).toBeCloseTo(axis - 25, 9);
		}
		expect(cuts(d)).toEqual([
			["A", 12, 263, 3156],
			["B", 3, 226, 678],
			["C", 3, 226, 678],
		]);
	});

	it("follows the imperial defaults: 12″ cube, 1″ tube, 1/2″ gap", () => {
		const [a, b] = cutList(DEFAULT_DESIGNS.imperial).items;
		// L1 = 12 − 2 − 1/2 = 9-1/2″, plus 1″ tip to tip
		expect(a?.cut).toBeCloseTo(10.5 * 25.4, 9);
		// L2 = 12 − 3 − 1 = 8″, plus 1″
		expect(b?.cut).toBeCloseTo(9 * 25.4, 9);
	});
});

describe("cut list, round tube with weld elbows", () => {
	const d = round("elbow");
	const r = defaultBendRadius(26.9);
	const { long, short } = axisLengths(d);

	it("cuts the straight tubes at L − 2R and buys the elbows", () => {
		const [a, b, c] = cutList(d).items;
		expect(a?.quantity).toBe(12);
		expect(a?.cut).toBeCloseTo(long - 2 * r, 9);
		expect(b?.quantity).toBe(6);
		expect(b?.cut).toBeCloseTo(short - 2 * r, 9);
		expect(c).toMatchObject({ quantity: 18, cut: null, total: 0 });
	});

	it("counts only the straight tubes in the stock length", () => {
		expect(cutList(d).total).toBeCloseTo(
			12 * (long - 2 * r) + 6 * (short - 2 * r),
			9,
		);
	});
});

describe("cut list, bent round tube", () => {
	const r = defaultBendRadius(26.9);
	const designs: [string, Design][] = [
		["default radius", round("bent")],
		["tight radius", round("bent", 26.9)],
		["large cube", { ...round("bent", 60), edge: 600, gap: 20 }],
	];

	describe.each(designs)("%s", (_, d) => {
		const loop = buildLoop(d);
		const { long, short } = axisLengths(d);
		const radius = d.profile.shape === "round" ? d.profile.bendRadius : 0;
		const arc = (Math.PI * radius) / 2;
		const list = cutList(d, loop);
		const [item] = list.items;
		const part = item?.part as SectionPart;
		const layout = sectionLayout(part, loop);

		it("cuts 6 identical sections of developed length L2 + 2·L1 − 6R + 3πR/2", () => {
			expect(list.items).toHaveLength(1);
			expect(item?.quantity).toBe(6);
			expect(item?.cut).toBeCloseTo(short + 2 * long - 6 * radius + 3 * arc, 9);
		});

		it("uses the length of the whole loop, each corner turned into a bend", () => {
			const loopLength = loop.segments.reduce((sum, s) => sum + s.length, 0);
			expect(list.total).toBeCloseTo(loopLength - 18 * (2 * radius - arc), 9);
		});

		it("measures L2/2 – L1 – L1 – L2/2 between welds and corners", () => {
			const expected = [short / 2, long, long, short / 2];
			layout.axis.forEach((l, k) => {
				expect(l).toBeCloseTo(expected[k] ?? Number.NaN, 9);
			});
		});

		it("places the bends from end 1 along the developed tube", () => {
			const starts = [
				short / 2 - radius,
				short / 2 - radius + arc + long - 2 * radius,
				short / 2 - radius + 2 * (arc + long - 2 * radius),
			];
			expect(layout.bends).toHaveLength(3);
			layout.bends.forEach((b, k) => {
				expect(b.start).toBeCloseTo(starts[k] ?? Number.NaN, 9);
				expect(b.end - b.start).toBeCloseTo(arc, 9);
				expect(b.angle).toBe(90);
			});
			const last = layout.bends.at(-1);
			expect((last?.end ?? 0) + short / 2 - radius).toBeCloseTo(part.length, 9);
		});

		it("keeps the three bends of a section in one plane", () => {
			expect(layout.bends.map((b) => b.twist)).toEqual([null, 0, 0]);
		});

		it("joins the sections with a rotation of ±90°, alternating", () => {
			const twists = layout.welds.map((w) => w.twist);
			expect(layout.welds.map((w) => w.mark)).toEqual(part.marks);
			expect(twists.map(Math.abs)).toEqual([90, 90, 90, 90, 90, 90]);
			twists.forEach((t, k) => {
				expect(t).toBe(-(twists[(k + 1) % twists.length] ?? 0));
			});
		});
	});

	it("matches the straights of parts() at the default radius", () => {
		const d = round("bent");
		const part = cutList(d).items[0]?.part as SectionPart;
		const { long, short } = axisLengths(d);
		expect(part.radius).toBe(r);
		expect(part.straights[0]).toBeCloseTo(short / 2 - r, 9);
		expect(part.straights[1]).toBeCloseTo(long - 2 * r, 9);
	});
});
