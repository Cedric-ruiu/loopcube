import { AXES, type Axis, map3, sub, unitAxis, type Vec3 } from "./vec";

export type ProfileShape = "square" | "round";

/**
 * Cube: every face alike. Framed: the top and bottom faces are full-size
 * frames, flush with the edges. Box: a framed cube with its own length (X)
 * and depth (Z).
 */
export type Pattern =
	| { kind: "cube" }
	| { kind: "framed" }
	| { kind: "box"; length: number; depth: number };

export type PatternKind = Pattern["kind"];

export interface CubeParams {
	/** A: outer size of the cube, i.e. the overall envelope; height of a box */
	edge: number;
	/** W: square profile width, or round tube outer diameter */
	width: number;
	/** G: clearance between two parallel bars, measured along an axis */
	gap: number;
	pattern: Pattern;
}

export interface Segment {
	index: number;
	start: Vec3;
	end: Vec3;
	axis: Axis;
	dir: Vec3;
	length: number;
}

export interface Loop {
	params: CubeParams;
	corners: Vec3[];
	segments: Segment[];
}

export interface Box {
	min: Vec3;
	max: Vec3;
}

export interface CubeEdge {
	axis: Axis;
	/** Signs of the two other coordinates, in axis order */
	side: readonly [number, number];
	segments: number[];
}

/** The 18 corners in travel order, as signed levels (spec §2.4). */
// biome-ignore format: keep the layout of the spec
export const CORNER_CODES: readonly Vec3[] = [
	[-2, -1, -2], [-2, -1, 1], [2, -1, 1], [2, 2, 1], [-1, 2, 1], [-1, -2, 1],
	[-1, -2, -2], [-1, 1, -2], [-1, 1, 2], [2, 1, 2], [2, 1, -1], [-2, 1, -1],
	[-2, -2, -1], [1, -2, -1], [1, 2, -1], [1, 2, 2], [1, -1, 2], [1, -1, -2],
];

/**
 * Same loop, the 6 corners where it turns in the top or bottom face moved
 * flush with the faces (spec §2.4).
 */
// biome-ignore format: keep the layout of the spec
export const FRAMED_CODES: readonly Vec3[] = [
	[-1, -1, -1], [-1, -1, 1], [2, -1, 1], [2, 2, 1], [-1, 2, 1], [-1, -2, 1],
	[-1, -2, -2], [-1, 1, -2], [-1, 1, 1], [1, 1, 1], [1, 1, -1], [-2, 1, -1],
	[-2, -2, -1], [1, -2, -1], [1, 2, -1], [1, 2, 2], [1, -1, 2], [1, -1, -1],
];

const EPS = 1e-9;

/** Outer size along X, Y and Z: length, height and depth of a box. */
export const extents = (p: CubeParams): Vec3 =>
	p.pattern.kind === "box"
		? [p.pattern.length, p.edge, p.pattern.depth]
		: [p.edge, p.edge, p.edge];

/**
 * Level 1 is flush with the faces of an envelope of `size` along the axis,
 * level 2 sits one bar and one gap inside.
 */
export function levelToCoordinate(
	code: number,
	size: number,
	p: CubeParams,
): number {
	const level = Math.abs(code) - 1;
	return Math.sign(code) * (size / 2 - p.width / 2 - level * (p.width + p.gap));
}

export function buildLoop(p: CubeParams): Loop {
	const size = extents(p);
	const codes = p.pattern.kind === "cube" ? CORNER_CODES : FRAMED_CODES;
	return loopFromCorners(
		codes.map((code) =>
			map3(code, (c, axis) => levelToCoordinate(c, size[axis], p)),
		),
		p,
	);
}

export function loopFromCorners(
	corners: readonly Vec3[],
	params: CubeParams,
): Loop {
	const segments = corners.map((start, index): Segment => {
		const end = corners[(index + 1) % corners.length] ?? start;
		const delta = sub(end, start);
		const axis = AXES.find((a) => Math.abs(delta[a]) > EPS);
		if (
			axis === undefined ||
			AXES.some((a) => a !== axis && Math.abs(delta[a]) > EPS)
		) {
			throw new Error(`Segment ${index} is not parallel to an axis`);
		}
		return {
			index,
			start,
			end,
			axis,
			dir: unitAxis(axis, delta[axis]),
			length: Math.abs(delta[axis]),
		};
	});
	return { params, corners: [...corners], segments };
}

/** Centreline lengths along an edge of size A: Y for a box. */
export function axisLengths(p: CubeParams): { long: number; short: number } {
	return {
		long: p.edge - 2 * p.width - p.gap,
		short: p.edge - 3 * p.width - 2 * p.gap,
	};
}

export function segmentBox(s: Segment, inflate: number): Box {
	return {
		min: map3(s.start, (v, a) => Math.min(v, s.end[a]) - inflate),
		max: map3(s.start, (v, a) => Math.max(v, s.end[a]) + inflate),
	};
}

export function boxGaps(a: Box, b: Box): Vec3 {
	return map3(a.min, (min, i) =>
		Math.max(0, min - b.max[i], b.min[i] - a.max[i]),
	);
}

export function envelopeBox(loop: Loop): Box {
	const boxes = loop.segments.map((s) => segmentBox(s, loop.params.width / 2));
	return {
		min: map3([0, 0, 0], (_, a) => Math.min(...boxes.map((b) => b.min[a]))),
		max: map3([0, 0, 0], (_, a) => Math.max(...boxes.map((b) => b.max[a]))),
	};
}

/**
 * Smallest clearance between two bars that are not neighbours in the loop.
 * `perAxis` is the gap seen in orthographic views, i.e. the G parameter.
 * `euclidean` is the true 3D distance between profile surfaces: parallel bars
 * face each other corner to corner, so it is larger than G.
 */
export function clearance(
	loop: Loop,
	shape: ProfileShape,
): { perAxis: number; euclidean: number } {
	const { segments, params } = loop;
	const half = params.width / 2;
	let perAxis = Number.POSITIVE_INFINITY;
	let euclidean = Number.POSITIVE_INFINITY;
	for (const a of segments) {
		for (const b of segments.slice(a.index + 2)) {
			if (a.index === 0 && b.index === segments.length - 1) continue;
			const outer = boxGaps(segmentBox(a, half), segmentBox(b, half));
			perAxis = Math.min(perAxis, Math.max(...outer));
			euclidean = Math.min(
				euclidean,
				shape === "square"
					? Math.hypot(...outer)
					: Math.hypot(...boxGaps(segmentBox(a, 0), segmentBox(b, 0))) -
							params.width,
			);
		}
	}
	return { perAxis, euclidean };
}

export function cubeEdges(loop: Loop): CubeEdge[] {
	const edges = new Map<string, CubeEdge>();
	for (const s of loop.segments) {
		const others = AXES.filter((a) => a !== s.axis);
		const side = [
			Math.sign(s.start[others[0] ?? 0]),
			Math.sign(s.start[others[1] ?? 0]),
		] as const;
		const key = `${s.axis}:${side.join(",")}`;
		const edge = edges.get(key) ?? { axis: s.axis, side, segments: [] };
		edge.segments.push(s.index);
		edges.set(key, edge);
	}
	return [...edges.values()];
}
