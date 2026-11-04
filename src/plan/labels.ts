import type { P2 } from "./render";

/**
 * Placement of labels with a leader (item balloons, weld symbols) around a
 * drawing, so that no leader crosses a piece other than the one it points to.
 */

/** Centreline of a piece on the sheet, with its depth (larger is nearer). */
export interface Axis {
	a: P2;
	b: P2;
	da: number;
	db: number;
}

export interface Poly {
	points: P2[];
	/** Each edge: a point and its outward unit normal */
	edges: { p: P2; n: P2 }[];
	min: P2;
	max: P2;
	axis?: Axis;
}

/** Convex hull of points, as a polygon (Andrew's monotone chain). */
export function hull(input: readonly P2[], axis?: Axis): Poly {
	const sorted = [...input].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	const cross = (o: P2, a: P2, b: P2) =>
		(a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
	const half = (points: P2[]) => {
		const out: P2[] = [];
		for (const p of points) {
			while (
				out.length >= 2 &&
				cross(out[out.length - 2] as P2, out[out.length - 1] as P2, p) <= 1e-9
			)
				out.pop();
			out.push(p);
		}
		out.pop();
		return out;
	};
	const points = [...half(sorted), ...half([...sorted].reverse())];
	const n = points.length;
	const cx = points.reduce((s, p) => s + p[0], 0) / n;
	const cy = points.reduce((s, p) => s + p[1], 0) / n;
	const edges = points.flatMap((p, i) => {
		const q = points[(i + 1) % n] ?? p;
		const l = Math.hypot(q[0] - p[0], q[1] - p[1]);
		if (l < 1e-9) return [];
		let normal: P2 = [(q[1] - p[1]) / l, -(q[0] - p[0]) / l];
		if (normal[0] * (cx - p[0]) + normal[1] * (cy - p[1]) > 0)
			normal = [-normal[0], -normal[1]];
		return [{ p, n: normal }];
	});
	const xs = points.map((p) => p[0]);
	const ys = points.map((p) => p[1]);
	return {
		points,
		edges,
		min: [Math.min(...xs), Math.min(...ys)],
		max: [Math.max(...xs), Math.max(...ys)],
		...(axis ? { axis } : {}),
	};
}

const ring = (c: P2, r: number, steps: number): P2[] =>
	Array.from({ length: steps }, (_, k): P2 => {
		const a = (k / steps) * 2 * Math.PI;
		const R = r / Math.cos(Math.PI / steps);
		return [c[0] + R * Math.cos(a), c[1] + R * Math.sin(a)];
	});

export const disc = (c: P2, r: number): Poly => hull(ring(c, r, 12));

export const box = (min: P2, max: P2): Poly =>
	hull([min, [max[0], min[1]], max, [min[0], max[1]]]);

export function band(
	points: readonly P2[],
	depths: readonly number[],
	r: number,
	step = 2,
): Poly[] {
	const out: Poly[] = [];
	for (let k = 0; k + 1 < points.length; k += step) {
		const last = Math.min(k + step, points.length - 1);
		const chunk = points.slice(k, last + 1);
		out.push(
			hull(
				chunk.flatMap((p) => ring(p, r, 16)),
				{
					a: points[k] ?? [0, 0],
					b: points[last] ?? [0, 0],
					da: depths[k] ?? 0,
					db: depths[last] ?? 0,
				},
			),
		);
	}
	return out;
}

function depthAt({ a, b, da, db }: Axis, x: P2): number {
	const dx = b[0] - a[0];
	const dy = b[1] - a[1];
	const l2 = dx * dx + dy * dy;
	const t =
		l2 < 1e-12
			? 0
			: Math.max(
					0,
					Math.min(1, ((x[0] - a[0]) * dx + (x[1] - a[1]) * dy) / l2),
				);
	return da + (db - da) * t;
}

const near = (p: Poly, min: P2, max: P2, pad: number) =>
	p.min[0] - pad <= max[0] &&
	p.max[0] + pad >= min[0] &&
	p.min[1] - pad <= max[1] &&
	p.max[1] + pad >= min[1];

export function inside(poly: Poly, x: P2, pad = 0): boolean {
	return (
		near(poly, x, x, pad) &&
		poly.edges.every(
			({ p, n }) => n[0] * (x[0] - p[0]) + n[1] * (x[1] - p[1]) <= pad,
		)
	);
}

/** Range of t in [0, 1] where a + t (b − a) lies in the polygon grown by `pad`. */
export function clip(
	a: P2,
	b: P2,
	poly: Poly,
	pad = 0,
): [number, number] | null {
	if (
		!near(
			poly,
			[Math.min(a[0], b[0]), Math.min(a[1], b[1])],
			[Math.max(a[0], b[0]), Math.max(a[1], b[1])],
			pad,
		)
	)
		return null;
	let t0 = 0;
	let t1 = 1;
	for (const { p, n } of poly.edges) {
		const num = n[0] * (a[0] - p[0]) + n[1] * (a[1] - p[1]) - pad;
		const den = n[0] * (b[0] - a[0]) + n[1] * (b[1] - a[1]);
		if (Math.abs(den) < 1e-12) {
			if (num > 0) return null;
		} else if (den > 0) t1 = Math.min(t1, -num / den);
		else t0 = Math.max(t0, -num / den);
		if (t0 > t1) return null;
	}
	return [t0, t1];
}

/** Whether two convex polygons come closer than `pad` (separating axes). */
export function overlap(a: Poly, b: Poly, pad = 0): boolean {
	if (!near(a, b.min, b.max, pad)) return false;
	for (const { n } of [...a.edges, ...b.edges]) {
		const extent = (poly: Poly) => {
			let lo = Number.POSITIVE_INFINITY;
			let hi = Number.NEGATIVE_INFINITY;
			for (const p of poly.points) {
				const v = p[0] * n[0] + p[1] * n[1];
				lo = Math.min(lo, v);
				hi = Math.max(hi, v);
			}
			return [lo, hi] as const;
		};
		const [alo, ahi] = extent(a);
		const [blo, bhi] = extent(b);
		if (alo > bhi + pad || blo > ahi + pad) return false;
	}
	return true;
}

function distance(p: P2, q: P2, r: P2): number {
	const dx = r[0] - q[0];
	const dy = r[1] - q[1];
	const l2 = dx * dx + dy * dy || 1e-12;
	const t = Math.max(
		0,
		Math.min(1, ((p[0] - q[0]) * dx + (p[1] - q[1]) * dy) / l2),
	);
	return Math.hypot(p[0] - q[0] - t * dx, p[1] - q[1] - t * dy);
}

function meet(a: P2, b: P2, c: P2, d: P2, pad: number): boolean {
	const side = (p: P2, q: P2, r: P2) =>
		Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
	if (side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0)
		return true;
	return (
		Math.min(
			distance(a, c, d),
			distance(b, c, d),
			distance(c, a, b),
			distance(d, a, b),
		) < pad
	);
}

export interface Anchor {
	at: P2;
	depth: number;
	axis?: P2;
	/**
	 * Half width of the piece across `axis`: the leader then ends in the
	 * middle of what is seen of that width, instead of at `at`
	 */
	half?: number;
	/** Pieces under this anchor, when they differ from the label's */
	pieces?: number[];
}

export interface Label {
	/** Pieces under the anchor: the only ones the leader may cross, near its end */
	pieces: number[];
	anchors: Anchor[];
	/** Leader directions to try, as angles on the sheet (y down) */
	directions: number[];
	body(end: P2, u: P2): Poly;
	minLength?: number;
	enough?: number;
	first?: boolean;
}

export interface Placed {
	anchor: P2;
	end: P2;
	u: P2;
	body: Poly;
	clear: boolean;
}

interface Candidate {
	anchor: P2;
	end: P2;
	u: P2;
	body: Poly;
	clean: boolean;
	cost: number;
}

const MAX_LEADER = 45;
const MAX_INSIDE = 10;
const MIN_OUT = 2.5;
const STEP = 1.5;
const ENOUGH = 120;
const PER_DIRECTION = 4;
const PIECE_PAD = 0.7;
const LABEL_PAD = 0.9;
const ANCHOR_PAD = 0.5;
/** Narrowest part of a piece a leader may end on: its dot stays inside */
const MIN_SEEN = 1.3;

export const around = (step: number): number[] =>
	Array.from(
		{ length: Math.round(360 / step) },
		(_, k) => (k * step * Math.PI) / 180,
	);

/**
 * Places each label at the end of a straight leader that crosses no piece
 * but its own, clear of the other labels and inside `area`. Labels outside
 * the drawing are preferred; a label goes inside it, in an empty space, when
 * nothing outside can reach its piece.
 */
export function placeLabels(
	pieces: readonly Poly[][],
	labels: readonly Label[],
	area: { min: P2; max: P2 },
	/**
	 * Depth by which a piece must be in front of another to hide it: pieces
	 * that only meet at a weld are at the same depth there
	 */
	margin = 0,
): Placed[] {
	const all = pieces.flatMap((polys, i) => polys.map((poly) => ({ i, poly })));
	const outline = hull(all.flatMap(({ poly }) => poly.points));
	const inArea = (p: Poly) =>
		p.min[0] >= area.min[0] &&
		p.min[1] >= area.min[1] &&
		p.max[0] <= area.max[0] &&
		p.max[1] <= area.max[1];
	// A piece hides a point only where it is in front
	const hides = (poly: Poly, x: P2, depth: number) =>
		!poly.axis || depthAt(poly.axis, x) > depth + margin;

	const hidden = (others: typeof all, x: P2, depth: number) =>
		others.some(
			({ poly }) => inside(poly, x, ANCHOR_PAD) && hides(poly, x, depth),
		);
	const seen = (
		anchor: Anchor,
		mine: typeof all,
		others: typeof all,
		narrowest = MIN_SEEN,
	): P2 | null => {
		const { at, axis, half, depth } = anchor;
		if (!axis || !half) return hidden(others, at, depth) ? null : at;
		const n: P2 = [-axis[1], axis[0]];
		const step = 0.2;
		let best: [number, number] | null = null;
		let start: number | null = null;
		for (let s = -half; s <= half + 1e-9; s += step) {
			const x: P2 = [at[0] + n[0] * s, at[1] + n[1] * s];
			const ok =
				mine.some(({ poly }) => inside(poly, x, -0.3)) &&
				!hidden(others, x, depth);
			if (ok && start === null) start = s;
			if ((!ok || s + step > half + 1e-9) && start !== null) {
				const end = ok ? s : s - step;
				if (!best || end - start > best[1] - best[0]) best = [start, end];
				start = null;
			}
		}
		if (!best || best[1] - best[0] < narrowest) return null;
		const s = (best[0] + best[1]) / 2;
		return [at[0] + n[0] * s, at[1] + n[1] * s];
	};

	/**
	 * Leader placements for a label, best first. A strict pass keeps the
	 * leader clear of every other piece and ends it on a part of its piece
	 * that is seen; the other pass, for a label that has no strict placement,
	 * counts the pieces crossed instead and allows a hidden end.
	 */
	const generate = (label: Label, strict: boolean): Candidate[] => {
		const out: Candidate[] = [];
		for (const [rank, anchor] of label.anchors.entries()) {
			if (out.length >= (label.enough ?? ENOUGH)) break;
			const own = new Set(anchor.pieces ?? label.pieces);
			const others = all.filter(({ i }) => !own.has(i));
			const mine = all.filter(({ i }) => own.has(i));
			// Without a clear way, a narrow part seen beats a hidden one
			const visible =
				seen(anchor, mine, others) ??
				(strict ? null : seen(anchor, mine, others, 0.4));
			if (!visible && strict) continue;
			const A = visible ?? anchor.at;
			for (const angle of label.directions) {
				const u: P2 = [Math.cos(angle), Math.sin(angle)];
				const at = (t: number): P2 => [A[0] + u[0] * t, A[1] + u[1] * t];
				const far = at(200);
				// Out of its own piece, through the overlapping parts of a bend
				let exit = 0;
				for (let pass = 0; pass < 30; pass++) {
					let next = exit;
					for (const { poly } of mine) {
						const r = clip(A, far, poly);
						if (r && r[0] * 200 <= exit + 1e-6)
							next = Math.max(next, r[1] * 200);
					}
					if (next <= exit + 1e-9) break;
					exit = next;
				}
				// Along its piece rather than across it
				if (exit > MAX_INSIDE) continue;
				exit += 0.3;
				const covering = new Set(
					others
						.filter(({ poly }) => {
							const r = clip(A, at(exit), poly, PIECE_PAD * 0.5);
							return (
								r !== null &&
								hides(poly, at((exit * (r[0] + r[1])) / 2), anchor.depth)
							);
						})
						.map(({ i }) => i),
				);
				if (strict && covering.size > 0) continue;
				// Free length beyond: up to the first piece, its own included
				let free = MAX_LEADER;
				const from = at(exit);
				const to = at(exit + MAX_LEADER);
				if (strict) {
					for (const { i, poly } of all) {
						const r = clip(from, to, poly, PIECE_PAD);
						if (!r) continue;
						if (r[0] > 0) free = Math.min(free, r[0] * MAX_LEADER);
						else if (own.has(i)) {
							// Just out of its own piece: only a return into it counts
							const back = clip(from, to, poly);
							if (back && back[0] > 0)
								free = Math.min(free, back[0] * MAX_LEADER);
						} else free = 0;
					}
				}
				const parallel = anchor.axis
					? Math.abs(anchor.axis[0] * u[1] - anchor.axis[1] * u[0])
					: 1;
				let kept = 0;
				for (
					let length = exit + Math.max(MIN_OUT, label.minLength ?? 0);
					length <= Math.min(exit + free, MAX_LEADER) && kept < PER_DIRECTION;
					length += STEP
				) {
					const end = at(length);
					const body = label.body(end, u);
					if (!inArea(body)) continue;
					if (all.some(({ poly }) => overlap(body, poly, PIECE_PAD))) continue;
					let crossed = 0;
					if (!strict) {
						const crossing = new Set(covering);
						for (const { i, poly } of others)
							if (clip(from, end, poly, PIECE_PAD * 0.5)) crossing.add(i);
						crossed = crossing.size;
					}
					const centre: P2 = [
						(body.min[0] + body.max[0]) / 2,
						(body.min[1] + body.max[1]) / 2,
					];
					kept++;
					out.push({
						anchor: A,
						end,
						u,
						body,
						clean: strict,
						cost:
							length +
							(rank * 0.4) / label.pieces.length +
							(parallel < 0.42 ? 10 : 0) +
							(inside(outline, centre) ? 12 : 0) +
							crossed * 25 +
							(visible ? 0 : 40),
					});
				}
			}
		}
		return out.sort((a, b) => a.cost - b.cost);
	};
	const candidates = labels.map((label) => {
		const strict = generate(label, true);
		return strict.length > 0 ? strict : generate(label, false);
	});

	const order = labels
		.map((label, k) => ({
			k,
			first: label.first ?? false,
			n: candidates[k]?.length ?? 0,
		}))
		.sort((a, b) => Number(b.first) - Number(a.first) || a.n - b.n);
	const placed: Placed[] = [];
	const done: Placed[] = [];
	const conflicts = (c: Candidate) => {
		let n = 0;
		for (const p of done) {
			if (overlap(c.body, p.body, LABEL_PAD)) n++;
			if (clip(c.anchor, c.end, p.body, LABEL_PAD * 0.7)) n++;
			if (clip(p.anchor, p.end, c.body, LABEL_PAD * 0.7)) n++;
			if (meet(c.anchor, c.end, p.anchor, p.end, 0.6)) n++;
		}
		return n;
	};
	for (const { k } of order) {
		const label = labels[k];
		if (!label) continue;
		let best: { c: Candidate; n: number } | undefined;
		for (const c of candidates[k] ?? []) {
			const n = conflicts(c);
			if (!best || n < best.n) best = { c, n };
			if (n === 0) break;
		}
		let result: Placed;
		if (best) {
			const { clean, cost: _, ...c } = best.c;
			result = { ...c, clear: clean && best.n === 0 };
		} else {
			// Nothing clear: straight out from the middle of the drawing
			const A = label.anchors[0]?.at ?? [0, 0];
			const mid: P2 = [
				(outline.min[0] + outline.max[0]) / 2,
				(outline.min[1] + outline.max[1]) / 2,
			];
			const l = Math.hypot(A[0] - mid[0], A[1] - mid[1]) || 1;
			const u: P2 = [(A[0] - mid[0]) / l, (A[1] - mid[1]) / l];
			const end: P2 = [A[0] + u[0] * 12, A[1] + u[1] * 12];
			result = { anchor: A, end, u, body: label.body(end, u), clear: false };
		}
		placed[k] = result;
		done.push(result);
	}
	return labels.map((_, k) => {
		const p = placed[k];
		if (!p) throw new Error("Label not placed");
		return p;
	});
}
