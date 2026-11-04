import {
	bend,
	bendPoint,
	type Design,
	type Loop,
	midpoint,
	mitredBar,
	type Part,
	straightRun,
	type Vec3,
} from "../geometry";
import { add, cross, dot, neg, scale, sub } from "../geometry/vec";

export type P2 = readonly [number, number];

/** Orthonormal viewing frame: right × up = toward, the viewer being on the toward side. */
export interface View {
	right: Vec3;
	up: Vec3;
	toward: Vec3;
}

export const view = (right: Vec3, up: Vec3): View => ({
	right,
	up,
	toward: cross(right, up),
});

const normalize = (v: Vec3): Vec3 => scale(v, 1 / Math.hypot(...v));

export function viewFrom(from: Vec3, up: Vec3 = [0, 1, 0]): View {
	const toward = normalize(from);
	const vertical = normalize(sub(up, scale(toward, dot(up, toward))));
	return { right: cross(vertical, toward), up: vertical, toward };
}

/** Y up, front seen from +Z (as in the 3D view). */
export const VIEWS = {
	front: view([1, 0, 0], [0, 1, 0]),
	top: view([1, 0, 0], [0, 0, -1]),
	left: view([0, 0, 1], [0, 1, 0]),
	right: view([0, 0, -1], [0, 1, 0]),
	// From the front, a little to the right and above, as the 3D view opens:
	// off every diagonal of the cube, so that no doubled bar hides behind its
	// neighbour (trimetric)
	axo: viewFrom([0.45, 0.55, 1]),
	// Along the 3-fold axis: the illusion of the endless line
	diagonal: viewFrom([1, 1, 1]),
} satisfies Record<string, View>;

/** Sheet coordinates (y up) and depth (larger is nearer). */
export const project = (v: View, p: Vec3): Vec3 => [
	dot(p, v.right),
	dot(p, v.up),
	dot(p, v.toward),
];

export interface Placement {
	scale: number;
	origin: P2;
}

export const toPaper = (pl: Placement, [x, y]: readonly number[]): P2 => [
	pl.origin[0] + (x ?? 0) * pl.scale,
	pl.origin[1] - (y ?? 0) * pl.scale,
];

export interface Bounds2 {
	min: P2;
	max: P2;
}

export function bounds2(points: readonly (readonly number[])[]): Bounds2 {
	const xs = points.map((p) => p[0] ?? 0);
	const ys = points.map((p) => p[1] ?? 0);
	return {
		min: [Math.min(...xs), Math.min(...ys)],
		max: [Math.max(...xs), Math.max(...ys)],
	};
}

export const viewBounds = (v: View, points: readonly Vec3[]): Bounds2 =>
	bounds2(points.map((p) => project(v, p)));

/**
 * Largest scale of the series that fits the bounds in the box (paper mm),
 * centred on the box. A null series fits exactly, without a standard scale.
 */
export function place(
	b: Bounds2,
	box: { x: number; y: number; width: number; height: number },
	series: readonly number[] | null,
): Placement {
	const w = Math.max(b.max[0] - b.min[0], 1e-9);
	const h = Math.max(b.max[1] - b.min[1], 1e-9);
	const fit = Math.min(box.width / w, box.height / h);
	const scaleValue = series
		? 1 / (series.find((n) => 1 / n <= fit + 1e-12) ?? series.at(-1) ?? 1)
		: fit;
	const cx = (b.min[0] + b.max[0]) / 2;
	const cy = (b.min[1] + b.max[1]) / 2;
	return {
		scale: scaleValue,
		origin: [
			box.x + box.width / 2 - cx * scaleValue,
			box.y + box.height / 2 + cy * scaleValue,
		],
	};
}

// Square bars: exact hidden lines on convex solids

export interface Solid {
	start: Vec3[];
	end: Vec3[];
}

export interface Edges {
	visible: [P2, P2][];
	hidden: [P2, P2][];
}

interface Occluder {
	poly: P2[];
	/** Plane in view space: n · (x, y, depth) = c */
	n: Vec3;
	c: number;
}

const EPS = 1e-6;

function signedArea(poly: readonly P2[]): number {
	let a = 0;
	poly.forEach((p, i) => {
		const q = poly[(i + 1) % poly.length] ?? p;
		a += p[0] * q[1] - q[0] * p[1];
	});
	return a / 2;
}

function clipInside(
	a: P2,
	b: P2,
	poly: readonly P2[],
): [number, number] | null {
	let t0 = 0;
	let t1 = 1;
	for (const [i, p] of poly.entries()) {
		const q = poly[(i + 1) % poly.length] ?? p;
		const ex = q[0] - p[0];
		const ey = q[1] - p[1];
		const len = Math.hypot(ex, ey);
		if (len < EPS) continue;
		const nx = -ey / len;
		const ny = ex / len;
		const num = nx * (a[0] - p[0]) + ny * (a[1] - p[1]) - EPS * 10;
		const den = nx * (b[0] - a[0]) + ny * (b[1] - a[1]);
		if (Math.abs(den) < EPS * EPS) {
			if (num <= 0) return null;
		} else if (den > 0) {
			t0 = Math.max(t0, -num / den);
		} else {
			t1 = Math.min(t1, -num / den);
		}
		if (t0 >= t1) return null;
	}
	return [t0, t1];
}

function faces(s: Solid): Vec3[][] {
	const sides = s.start.map((p, k) => [
		p,
		s.start[(k + 1) % 4] ?? p,
		s.end[(k + 1) % 4] ?? p,
		s.end[k] ?? p,
	]);
	return sides;
}

/**
 * Visible and hidden edges of mitred bars. The cut faces are shared by two
 * bars and never seen from outside, so only the side faces hide anything.
 */
export function hiddenLines(solids: readonly Solid[], v: View): Edges {
	const occluders: Occluder[] = [];
	for (const s of solids) {
		const all = [...s.start, ...s.end];
		const center = scale(
			all.reduce((sum, p) => add(sum, p), [0, 0, 0]),
			1 / all.length,
		);
		for (const face of faces(s)) {
			const [a = center, b = center, c = center] = face;
			let normal = cross(sub(b, a), sub(c, a));
			if (Math.hypot(...normal) < EPS) {
				normal = cross(sub(c, b), sub(face[3] ?? c, b));
			}
			if (dot(normal, sub(a, center)) < 0) normal = neg(normal);
			const n = project(v, normalize(normal));
			if (n[2] < 1e-4) continue;
			let poly = face.map((p): P2 => {
				const [x, y] = project(v, p);
				return [x, y];
			});
			if (signedArea(poly) < 0) poly = poly.reverse();
			occluders.push({ poly, n, c: dot(n, project(v, a)) });
		}
	}

	const visible: [P2, P2][] = [];
	const hidden: [P2, P2][] = [];
	const edge = (p: Vec3, q: Vec3) => {
		const a3 = project(v, p);
		const b3 = project(v, q);
		const a: P2 = [a3[0], a3[1]];
		const b: P2 = [b3[0], b3[1]];
		if (Math.hypot(b[0] - a[0], b[1] - a[1]) < EPS) return;
		const covered: [number, number][] = [];
		for (const o of occluders) {
			const range = clipInside(a, b, o.poly);
			if (!range) continue;
			const gap = (t: number) => {
				const x = a[0] + (b[0] - a[0]) * t;
				const y = a[1] + (b[1] - a[1]) * t;
				const depth = a3[2] + (b3[2] - a3[2]) * t;
				return (o.c - o.n[0] * x - o.n[1] * y) / o.n[2] - depth;
			};
			const [t0, t1] = range;
			const g0 = gap(t0) - 1e-4;
			const g1 = gap(t1) - 1e-4;
			if (g0 <= 0 && g1 <= 0) continue;
			if (g0 > 0 && g1 > 0) covered.push([t0, t1]);
			else {
				const tc = t0 + ((t1 - t0) * g0) / (g0 - g1);
				covered.push(g0 > 0 ? [t0, tc] : [tc, t1]);
			}
		}
		covered.sort((x, y) => x[0] - y[0]);
		const at = (t: number): P2 => [
			a[0] + (b[0] - a[0]) * t,
			a[1] + (b[1] - a[1]) * t,
		];
		let t = 0;
		for (const [c0, c1] of covered) {
			if (c0 > t + 1e-6) visible.push([at(t), at(c0)]);
			if (c1 > t) {
				hidden.push([at(Math.max(t, c0)), at(c1)]);
				t = c1;
			}
		}
		if (t < 1 - 1e-6) visible.push([at(t), b]);
	};
	for (const s of solids) {
		s.start.forEach((p, k) => {
			edge(p, s.end[k] ?? p);
			edge(p, s.start[(k + 1) % 4] ?? p);
			edge(s.end[k] ?? p, s.end[(k + 1) % 4] ?? p);
		});
	}
	return { visible, hidden };
}

// Round tubes: painter's algorithm on short pieces of the centreline

export interface TubeScene {
	paths: Vec3[][];
	welds: { at: Vec3; axis: Vec3 }[];
	radius: number;
}

export type TubeItem =
	| { kind: "band"; a: P2; b: P2 }
	| { kind: "curve"; points: P2[] }
	| { kind: "disc"; c: P2 }
	| { kind: "weld"; points: P2[] };

const BEND_STEPS = 12;
const WELD_STEPS = 24;

export const bendSamples = (loop: Loop, corner: number, radius: number) => {
	const b = bend(loop, corner, radius);
	return Array.from({ length: BEND_STEPS + 1 }, (_, k) =>
		bendPoint(b, (k / BEND_STEPS) * (Math.PI / 2)),
	);
};

export function tubePaths(part: Part, loop: Loop, radius: number): Vec3[][][] {
	const segment = (i: number) => {
		const s = loop.segments[i];
		if (!s) throw new RangeError(`No segment ${i}`);
		return s;
	};
	switch (part.kind) {
		case "tube":
			return part.segments.map((i) => {
				const run = straightRun(loop, i, radius);
				return [[run.start, run.end]];
			});
		case "elbow":
			return part.corners.map((c) => [bendSamples(loop, c, part.radius)]);
		case "section":
			return part.sections.map(({ segments }) =>
				segments.flatMap((i, k) => {
					const s = segment(i);
					const run = straightRun(loop, i, radius);
					const middle = midpoint(s.start, s.end);
					const first = k === 0;
					return [
						...(first ? [] : [bendSamples(loop, i, radius)]),
						[
							first ? middle : run.start,
							k === segments.length - 1 ? middle : run.end,
						],
					];
				}),
			);
		case "bar":
			return [];
	}
}

export const joinRuns = (runs: readonly Vec3[][]): Vec3[] =>
	runs.flatMap((run, k) => (k === 0 ? run : run.slice(1)));

export function tubeWelds(part: Part, loop: Loop): TubeScene["welds"] {
	switch (part.kind) {
		case "elbow":
			return part.corners.flatMap((c) => {
				const b = bend(loop, c, part.radius);
				return [
					{ at: b.start, axis: b.to },
					{ at: b.end, axis: b.from },
				];
			});
		case "section":
			return part.sections.map(({ segments }) => {
				const s = loop.segments[segments[0] ?? 0];
				if (!s) throw new RangeError("Section without segment");
				return { at: midpoint(s.start, s.end), axis: s.dir };
			});
		default:
			return [];
	}
}

export function solidsOf(part: Part, loop: Loop): Solid[] {
	return part.kind === "bar"
		? part.segments.map((i) => mitredBar(loop, i))
		: [];
}

export const bendRadiusOf = (d: Design): number =>
	d.profile.shape === "round" ? d.profile.bendRadius : 0;

/** Painting order, far to near. */
export function tubeItems(scene: TubeScene, v: View): TubeItem[] {
	const items: { depth: number; item: TubeItem }[] = [];
	const chunk = scene.radius;
	for (const path of scene.paths) {
		if (path.length > 2) {
			// A bend is painted in one stroke: joined pieces would leave seams
			const points = path.map((p) => project(v, p));
			items.push({
				depth: points.reduce((sum, p) => sum + p[2], 0) / points.length,
				item: { kind: "curve", points: points.map(([x, y]) => [x, y]) },
			});
			continue;
		}
		path.slice(1).forEach((q, k) => {
			const p = path[k] ?? q;
			const a3 = project(v, p);
			const b3 = project(v, q);
			const length2 = Math.hypot(b3[0] - a3[0], b3[1] - a3[1]);
			if (length2 < EPS) {
				const near = a3[2] > b3[2] ? a3 : b3;
				if (Math.hypot(...sub(q, p)) > EPS) {
					items.push({
						depth: near[2],
						item: { kind: "disc", c: [near[0], near[1]] },
					});
				}
				return;
			}
			const n = Math.max(1, Math.ceil(Math.hypot(...sub(q, p)) / chunk));
			for (let i = 0; i < n; i++) {
				const at = (t: number): Vec3 => [
					a3[0] + (b3[0] - a3[0]) * t,
					a3[1] + (b3[1] - a3[1]) * t,
					a3[2] + (b3[2] - a3[2]) * t,
				];
				const s = at(i / n);
				const e = at((i + 1) / n);
				items.push({
					depth: (s[2] + e[2]) / 2,
					item: { kind: "band", a: [s[0], s[1]], b: [e[0], e[1]] },
				});
			}
		});
	}
	for (const { at, axis } of scene.welds) {
		const helper: Vec3 = Math.abs(axis[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
		const u = normalize(cross(axis, helper));
		const w = cross(axis, u);
		const ring = Array.from({ length: WELD_STEPS + 1 }, (_, k) => {
			const angle = (k / WELD_STEPS) * 2 * Math.PI;
			return add(
				at,
				add(
					scale(u, scene.radius * Math.cos(angle)),
					scale(w, scene.radius * Math.sin(angle)),
				),
			);
		});
		// Front half of the ring only; the back half is behind the tube
		const front = ring.filter((p) => dot(sub(p, at), v.toward) >= -EPS);
		const start = ring.findIndex(
			(p, k) =>
				dot(sub(p, at), v.toward) >= -EPS &&
				dot(sub(ring[(k + WELD_STEPS - 1) % WELD_STEPS] ?? p, at), v.toward) <
					-EPS,
		);
		const ordered =
			start < 0
				? front
				: Array.from(
						{ length: WELD_STEPS },
						(_, k) => ring[(start + k) % WELD_STEPS],
					)
						.filter((p): p is Vec3 => p !== undefined)
						.filter((p) => dot(sub(p, at), v.toward) >= -EPS);
		const c = project(v, at);
		items.push({
			depth: c[2] + scene.radius,
			item: {
				kind: "weld",
				points: ordered.map((p) => {
					const [x, y] = project(v, p);
					return [x, y];
				}),
			},
		});
	}
	return items.sort((a, b) => a.depth - b.depth).map((i) => i.item);
}
