import { describe, expect, it } from "vitest";
import {
	axisLengths,
	type Bend,
	bend,
	bendPoint,
	bentSections,
	bounds,
	buildLoop,
	type CubeParams,
	classifyPieces,
	clearance,
	cubeEdges,
	DEFAULT_DESIGNS,
	type Design,
	defaultBendRadius,
	envelopeBox,
	loopFromCorners,
	MIN_STRAIGHT,
	mitredBar,
	parts,
	pieceEnds,
	quantity,
	segmentBox,
	shortestStraight,
	straightRun,
	type Vec3,
	validate,
} from "./index";
import { boxGaps } from "./loop";
import { add, cross, cyclic, dot, map3, scale, sub } from "./vec";

const PARAM_SETS: [string, CubeParams][] = [
	["spec example 300/25/12", { edge: 300, width: 25, gap: 12 }],
	["metric defaults 300/25/12.5", { edge: 300, width: 25, gap: 12.5 }],
	["large bar 500/40/5", { edge: 500, width: 40, gap: 5 }],
	["imperial 12in/1in/0.5in", { edge: 304.8, width: 25.4, gap: 12.7 }],
	["round tube 300/26.9/13.45", { edge: 300, width: 26.9, gap: 13.45 }],
];

describe.each(PARAM_SETS)("loop geometry, %s", (_, p) => {
	const loop = buildLoop(p);
	const { segments, corners } = loop;

	it("is a closed loop of 18 corners and 18 bars", () => {
		expect(corners).toHaveLength(18);
		expect(segments).toHaveLength(18);
		expect(segments.at(-1)?.end).toEqual(corners[0]);
	});

	it("moves along a single axis between consecutive corners", () => {
		for (const s of segments) {
			const moved = map3(s.start, (v, a) =>
				Math.abs(v - s.end[a]) > 1e-9 ? 1 : 0,
			);
			expect(moved[0] + moved[1] + moved[2]).toBe(1);
		}
	});

	it("turns at a right angle at every corner", () => {
		for (const s of segments) {
			const next = segments[(s.index + 1) % segments.length];
			expect(next).toBeDefined();
			if (next) expect(dot(s.dir, next.dir)).toBe(0);
		}
	});

	it("doubles 6 cube edges, never aligned, and keeps 6 single", () => {
		const edges = cubeEdges(loop);
		expect(edges).toHaveLength(12);
		const doubled = edges.filter((e) => e.segments.length === 2);
		expect(doubled).toHaveLength(6);
		expect(edges.filter((e) => e.segments.length === 1)).toHaveLength(6);
		for (const edge of doubled) {
			const [a, b] = edge.segments.map((i) => segments[i]);
			if (!a || !b) throw new Error("missing bar");
			const offsets = map3(a.start, (v, axis) =>
				axis === edge.axis ? 0 : Math.abs(v - b.start[axis]),
			);
			expect(offsets.filter((o) => o > 0)).toHaveLength(2);
		}
	});

	it("fits exactly in a cube of edge A", () => {
		const box = envelopeBox(loop);
		for (const axis of [0, 1, 2] as const) {
			expect(box.min[axis]).toBeCloseTo(-p.edge / 2, 9);
			expect(box.max[axis]).toBeCloseTo(p.edge / 2, 9);
		}
	});

	it("keeps exactly G between non-consecutive bars, measured axis by axis", () => {
		const square = clearance(loop, "square");
		expect(square.perAxis).toBeCloseTo(p.gap, 9);
		expect(square.euclidean).toBeCloseTo(p.gap * Math.SQRT2, 9);
		const round = clearance(loop, "round");
		expect(round.perAxis).toBeCloseTo(p.gap, 9);
		expect(round.euclidean).toBeCloseTo(
			(p.width + p.gap) * Math.SQRT2 - p.width,
			9,
		);
	});

	it("touches its two neighbours at the corners", () => {
		for (const s of segments) {
			const next = segments[(s.index + 1) % segments.length];
			if (!next) throw new Error("missing bar");
			const gaps = boxGaps(
				segmentBox(s, p.width / 2),
				segmentBox(next, p.width / 2),
			);
			expect(Math.max(...gaps)).toBe(0);
		}
	});

	it("has 12 long bars of A − 2W − G and 6 short bars of A − 3W − 2G", () => {
		const { long, short } = axisLengths(p);
		expect(long).toBeCloseTo(p.edge - 2 * p.width - p.gap, 9);
		expect(short).toBeCloseTo(p.edge - 3 * p.width - 2 * p.gap, 9);
		const lengths = segments.map((s) => s.length);
		expect(lengths.filter((l) => Math.abs(l - long) < 1e-9)).toHaveLength(12);
		expect(lengths.filter((l) => Math.abs(l - short) < 1e-9)).toHaveLength(6);
	});

	it("has 3-fold symmetry around the main diagonal", () => {
		const rotated = corners.map((c) => map3(c, (_, a) => c[(a + 1) % 3] ?? 0));
		const shift = corners.findIndex((c) =>
			c.every((v, a) => v === rotated[0]?.[a]),
		);
		expect(shift).toBeGreaterThan(0);
		rotated.forEach((c, i) => {
			expect(c).toEqual(corners[(i + shift) % corners.length]);
		});
	});

	it("classifies the mitred bars into 12 + 3 + 3 computed types", () => {
		const { long, short } = axisLengths(p);
		const types = classifyPieces(loop);
		expect(types.map((t) => t.segments.length)).toEqual([12, 3, 3]);
		const [u, right, left] = types;
		expect(u).toMatchObject({
			id: "A",
			relation: "same-side",
			twist: 0,
			chirality: 0,
		});
		expect(u?.length).toBeCloseTo(long, 9);
		expect(right).toMatchObject({
			id: "B",
			relation: "twisted",
			twist: 90,
			chirality: 1,
		});
		expect(left).toMatchObject({
			id: "C",
			relation: "twisted",
			twist: -90,
			chirality: -1,
		});
		expect(right?.length).toBeCloseTo(short, 9);
		expect(left?.length).toBeCloseTo(short, 9);
	});
});

describe("spec example A=300, W=25, G=12", () => {
	it("gives 12 × 238 mm and 6 × 201 mm", () => {
		const types = classifyPieces(buildLoop({ edge: 300, width: 25, gap: 12 }));
		expect(types.map((t) => [t.segments.length, t.length])).toEqual([
			[12, 238],
			[3, 201],
			[3, 201],
		]);
	});
});

describe("piece classification", () => {
	it("follows the geometry instead of fixed results: a mirrored loop swaps handedness", () => {
		const p = { edge: 300, width: 25, gap: 12.5 };
		const mirrored = buildLoop(p).corners.map((c) =>
			map3(c, (v, a) => (a === 0 ? -v : v)),
		);
		const original = classifyPieces(buildLoop(p));
		const types = classifyPieces(loopFromCorners(mirrored, p));
		expect(types.map((t) => t.segments.length)).toEqual([12, 3, 3]);
		expect(types[1]?.segments).toEqual(original[2]?.segments);
		expect(types[2]?.segments).toEqual(original[1]?.segments);
	});
});

const ROUND_ELBOW: Design = {
	edge: 300,
	width: 26.9,
	gap: 13.45,
	wall: 2.6,
	profile: {
		shape: "round",
		joint: "elbow",
		bendRadius: defaultBendRadius(26.9),
	},
};
const ROUND_BENT: Design = {
	...ROUND_ELBOW,
	profile: {
		shape: "round",
		joint: "bent",
		bendRadius: defaultBendRadius(26.9),
	},
};
const DESIGNS: [string, Design][] = [
	["metric square", DEFAULT_DESIGNS.metric],
	["imperial square", DEFAULT_DESIGNS.imperial],
	["round tube with elbows", ROUND_ELBOW],
	["bent round tube", ROUND_BENT],
];
const withRadius = (d: Design, bendRadius: number): Design =>
	d.profile.shape === "round"
		? { ...d, profile: { ...d.profile, bendRadius } }
		: d;
const codes = (d: Design) => validate(d).map((i) => i.code);
const STEP = 0.01;

describe.each(DESIGNS)("validation, %s", (_, d) => {
	it("accepts the default design", () => {
		expect(validate(d)).toEqual([]);
	});

	it("rejects a gap of zero or less", () => {
		expect(validate({ ...d, gap: 0 })).toContainEqual({
			code: "notPositive",
			param: "gap",
		});
		expect(validate({ ...d, gap: -1 })).toContainEqual({
			code: "notPositive",
			param: "gap",
		});
	});

	it("rejects a wall thicker than half the width", () => {
		expect(codes({ ...d, wall: d.width / 2 })).toEqual([]);
		expect(codes({ ...d, wall: d.width / 2 + STEP })).toEqual(["wallTooThick"]);
	});

	it("stops the edge at the minimum straight run", () => {
		const { min } = bounds(d).edge;
		expect(shortestStraight({ ...d, edge: min })).toBeCloseTo(MIN_STRAIGHT, 9);
		expect(validate({ ...d, edge: min })).toEqual([]);
		expect(validate({ ...d, edge: min - STEP })).toEqual([
			{ code: "straightTooShort", param: "edge", limit: min },
		]);
	});

	it("stops the gap at its maximum", () => {
		const { max } = bounds(d).gap;
		expect(codes({ ...d, gap: max })).toEqual([]);
		expect(codes({ ...d, gap: max + STEP })).toEqual(["straightTooShort"]);
	});

	it("stops the width at its maximum, gap fixed", () => {
		const { max } = bounds(d).width;
		expect(codes({ ...d, width: max })).toEqual([]);
		expect(codes({ ...d, width: max + STEP })).not.toEqual([]);
	});

	it("stops the width at its maximum, gap and radius following the width", () => {
		const links = { gapRatio: 0.5, bendRadiusRatio: 1.5 };
		const { max } = bounds(d, links).width;
		const follow = (w: number) =>
			withRadius({ ...d, width: w, gap: w * 0.5 }, w * 1.5);
		expect(codes(follow(max))).toEqual([]);
		expect(codes(follow(max + STEP))).toEqual(["straightTooShort"]);
	});
});

describe.each([
	["elbows", ROUND_ELBOW],
	["bent", ROUND_BENT],
])("round tube radius, %s", (_, d) => {
	it("needs at least one diameter", () => {
		expect(codes(withRadius(d, d.width))).toEqual([]);
		expect(codes(withRadius(d, d.width - STEP))).toEqual([
			"bendRadiusTooSmall",
		]);
	});

	it("stops the radius at the minimum straight run", () => {
		const range = bounds(d).bendRadius;
		if (!range) throw new Error("no radius range");
		expect(codes(withRadius(d, range.max))).toEqual([]);
		expect(codes(withRadius(d, range.max + STEP))).toEqual([
			"straightTooShort",
		]);
	});
});

describe("round tube straight runs", () => {
	it("rejects elbows when L2 − 2R drops under the minimum", () => {
		const { short } = axisLengths(ROUND_ELBOW);
		expect(codes(withRadius(ROUND_ELBOW, short / 2))).toEqual([
			"straightTooShort",
		]);
	});

	it("keeps L2/2 − R on each side of the weld of a bent section", () => {
		const { short } = axisLengths(ROUND_BENT);
		expect(shortestStraight(ROUND_BENT)).toBeCloseTo(
			short / 2 - defaultBendRadius(26.9),
			9,
		);
	});
});

const expectClose = (a: Vec3, b: Vec3) => {
	a.forEach((v, i) => {
		expect(v).toBeCloseTo(b[i] ?? Number.NaN, 9);
	});
};

describe("mitred bars", () => {
	const loop = buildLoop(DEFAULT_DESIGNS.metric);
	const key = (v: Vec3) => v.map((c) => c.toFixed(6)).join(",");

	it("share each cut face with the neighbouring bar", () => {
		for (const s of loop.segments) {
			const next = mitredBar(loop, s.index + 1).start.map(key);
			expect(mitredBar(loop, s.index).end.map(key).sort()).toEqual(next.sort());
		}
	});

	it("measure L + W tip to tip and L − W on the inside", () => {
		const { width } = loop.params;
		for (const s of loop.segments) {
			const { start, end } = mitredBar(loop, s.index);
			const edges = start.map((p, k) => Math.hypot(...sub(end[k] ?? p, p)));
			expect(Math.max(...edges)).toBeCloseTo(s.length + width, 9);
			expect(Math.min(...edges)).toBeCloseTo(s.length - width, 9);
		}
	});

	it("stay inside the cube", () => {
		const half = loop.params.edge / 2;
		for (const s of loop.segments) {
			const { start, end } = mitredBar(loop, s.index);
			for (const v of [...start, ...end]) {
				expect(Math.max(...v.map(Math.abs))).toBeLessThanOrEqual(half + 1e-9);
			}
		}
	});
});

describe("bends", () => {
	const loop = buildLoop(ROUND_ELBOW);
	const radius = defaultBendRadius(ROUND_ELBOW.width);

	it("are tangent to the straight runs on both sides", () => {
		for (const corner of loop.corners.keys()) {
			const b = bend(loop, corner, radius);
			expectClose(b.start, straightRun(loop, corner - 1, radius).end);
			expectClose(b.end, straightRun(loop, corner, radius).start);
			expectClose(bendPoint(b, 0), b.start);
			expectClose(bendPoint(b, Math.PI / 2), b.end);
			const half = sub(bendPoint(b, Math.PI / 4), b.center);
			expect(Math.hypot(...half)).toBeCloseTo(radius, 9);
			expect(dot(b.from, b.to)).toBeCloseTo(0, 12);
		}
	});
});

const distance = (a: Vec3, b: Vec3) => Math.hypot(...sub(a, b));

function distanceToSegment(p: Vec3, a: Vec3, b: Vec3): number {
	const ab = sub(b, a);
	const t = Math.min(1, Math.max(0, dot(sub(p, a), ab) / dot(ab, ab)));
	return distance(p, add(a, scale(ab, t)));
}

function distanceToBend(p: Vec3, b: Bend): number {
	const v = sub(p, b.center);
	const angle = Math.atan2(dot(v, b.to), dot(v, b.from));
	return angle >= 0 && angle <= Math.PI / 2
		? distance(p, bendPoint(b, angle))
		: Math.min(distance(p, b.start), distance(p, b.end));
}

const ARC_SAMPLES = 32;
const maxRadius = (d: Design) => bounds(d).bendRadius?.max ?? Number.NaN;

describe.each([
	["default elbows", ROUND_ELBOW, defaultBendRadius(ROUND_ELBOW.width)],
	["tightest bends", ROUND_ELBOW, ROUND_ELBOW.width],
	["small gap", { ...ROUND_ELBOW, gap: 5 }, defaultBendRadius(26.9)],
	["widest elbows", ROUND_ELBOW, maxRadius(ROUND_ELBOW)],
	["widest bends of a bent tube", ROUND_BENT, maxRadius(ROUND_BENT)],
	[
		"large cube, small gap, wide bends",
		{ ...ROUND_ELBOW, edge: 600, gap: 2 },
		3 * ROUND_ELBOW.width,
	],
])("bend clearance, %s", (_, d, radius) => {
	it("leaves the bars as far apart as straight bars (spec §4.3)", () => {
		expect(validate(withRadius(d, radius))).toEqual([]);
		const loop = buildLoop(d);
		const n = loop.segments.length;
		const bends = loop.corners.map((_, c) => bend(loop, c, radius));
		const runs = loop.segments.map((s) => straightRun(loop, s.index, radius));
		let nearest = Number.POSITIVE_INFINITY;
		for (const b of bends) {
			// Parts joined to this bend, directly or through one straight run
			const near = (i: number) => (i - b.corner + n + 1) % n <= 2;
			for (let k = 0; k <= ARC_SAMPLES; k++) {
				const p = bendPoint(b, (k / ARC_SAMPLES) * (Math.PI / 2));
				runs.forEach((run, i) => {
					if (i !== b.corner && i !== (b.corner + n - 1) % n) {
						nearest = Math.min(
							nearest,
							distanceToSegment(p, run.start, run.end),
						);
					}
				});
				for (const other of bends) {
					if (!near(other.corner)) {
						nearest = Math.min(nearest, distanceToBend(p, other));
					}
				}
			}
		}
		const straight = clearance(loop, "round").euclidean;
		expect(nearest - d.width).toBeGreaterThanOrEqual(straight - 1e-9);
	});
});

describe("parts", () => {
	const summary = (d: Design) =>
		parts(d).map((p) => [p.id, p.kind, quantity(p)]);

	it("marks the mitred bars A, B, C as classified", () => {
		expect(summary(DEFAULT_DESIGNS.metric)).toEqual([
			["A", "bar", 12],
			["B", "bar", 3],
			["C", "bar", 3],
		]);
	});

	it.each([
		["mitred bars", DEFAULT_DESIGNS.metric, { A: 12, B: 3, C: 3 }],
		["tube with elbows", ROUND_ELBOW, { A: 12, B: 6 }],
		["bent tube", ROUND_BENT, { A: 6 }],
	])("numbers each piece within its part: %s", (_, d, counts) => {
		const expected = Object.entries(counts).flatMap(([id, n]) =>
			Array.from({ length: n }, (_, k) => `${id}${k + 1}`),
		);
		const numbered = parts(d).filter((p) => p.kind !== "elbow");
		expect(numbered.flatMap((p) => p.marks)).toEqual(expected);
	});

	it("marks the 18 identical elbows with their part only", () => {
		const elbows = parts(ROUND_ELBOW).find((p) => p.kind === "elbow");
		expect(elbows?.marks).toEqual(Array.from({ length: 18 }, () => "C"));
	});

	it("splits a tube with elbows into straight tubes and elbows", () => {
		const { long, short } = axisLengths(ROUND_ELBOW);
		const radius = defaultBendRadius(ROUND_ELBOW.width);
		expect(summary(ROUND_ELBOW)).toEqual([
			["A", "tube", 12],
			["B", "tube", 6],
			["C", "elbow", 18],
		]);
		const [a, b, c] = parts(ROUND_ELBOW);
		expect(a?.kind === "tube" && a.length).toBeCloseTo(long - 2 * radius, 9);
		expect(b?.kind === "tube" && b.length).toBeCloseTo(short - 2 * radius, 9);
		expect(c?.kind === "elbow" && c.radius).toBe(radius);
	});

	describe("bent tube", () => {
		const loop = buildLoop(ROUND_BENT);
		const { long, short } = axisLengths(ROUND_BENT);
		const radius = defaultBendRadius(ROUND_BENT.width);
		const [section, ...others] = parts(ROUND_BENT);

		it("gives 6 identical sections L2/2 – L1 – L1 – L2/2", () => {
			expect(others).toEqual([]);
			if (section?.kind !== "section") throw new Error("no section");
			expect(section.sections).toHaveLength(6);
			const expected = [
				short / 2 - radius,
				long - 2 * radius,
				long - 2 * radius,
				short / 2 - radius,
			];
			section.straights.forEach((l, i) => {
				expect(l).toBeCloseTo(expected[i] ?? Number.NaN, 9);
			});
			expect(section.twists).toEqual([0, 0]);
			expect(section.length).toBeCloseTo(
				short + 2 * long - 6 * radius + (3 * Math.PI * radius) / 2,
				9,
			);
		});

		it("covers the loop once, cutting each short bar in two", () => {
			const uses = new Map<number, number>();
			for (const { segments } of bentSections(loop)) {
				for (const i of segments) uses.set(i, (uses.get(i) ?? 0) + 1);
			}
			for (const s of loop.segments) {
				expect(uses.get(s.index)).toBe(s.length < long ? 2 : 1);
			}
		});

		it("keeps each section in a plane, welded to the next one at ±90°", () => {
			const ends = pieceEnds(loop);
			for (const { segments } of bentSections(loop)) {
				const first = cyclic(loop.segments, segments[0] ?? 0);
				const last = cyclic(loop.segments, segments.at(-1) ?? 0);
				const points = [
					first.start,
					...segments.slice(1).map((i) => cyclic(loop.corners, i)),
					last.end,
				];
				const [o = first.start, a = o, b = o] = points;
				const normal = cross(sub(a, o), sub(b, o));
				for (const p of points)
					expect(dot(sub(p, o), normal)).toBeCloseTo(0, 6);
				expect(Math.abs(cyclic(ends, first.index).twist)).toBe(90);
			}
		});
	});
});
