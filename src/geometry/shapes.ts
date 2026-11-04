import type { Loop } from "./loop";
import {
	AXES,
	add,
	cyclic,
	dot,
	lerp,
	neg,
	scale,
	sub,
	unitAxis,
	type Vec3,
} from "./vec";

const PROFILE_CORNERS = [
	[1, 1],
	[-1, 1],
	[-1, -1],
	[1, -1],
] as const;

/**
 * Corners of a square bar mitred at 45° on both ends. `start[k]` and `end[k]`
 * lie on the same long edge of the bar; each cut face is shared with the
 * neighbouring bar.
 */
export function mitredBar(
	loop: Loop,
	index: number,
): { start: Vec3[]; end: Vec3[] } {
	const s = cyclic(loop.segments, index);
	const prev = cyclic(loop.segments, index - 1).dir;
	const next = cyclic(loop.segments, index + 1).dir;
	const half = loop.params.width / 2;
	const [u, v] = AXES.filter((a) => a !== s.axis).map((a) => unitAxis(a, 1));
	if (!u || !v) throw new Error("Bar without cross-section axes");
	const offsets = PROFILE_CORNERS.map(([a, b]) =>
		add(scale(u, a * half), scale(v, b * half)),
	);
	// The cut between bars of directions d1 and d2 is the plane of normal
	// d1 + d2 through their corner: along an edge offset by o from the axis,
	// it sits at −o·d_prev from the start and L − o·d_next from the start.
	const at = (o: Vec3, t: number): Vec3 =>
		add(add(s.start, o), scale(s.dir, t));
	return {
		start: offsets.map((o) => at(o, -dot(o, prev))),
		end: offsets.map((o) => at(o, s.length - dot(o, next))),
	};
}

export interface Bend {
	/** Corner index: the bend joins segment `corner − 1` to segment `corner` */
	corner: number;
	radius: number;
	center: Vec3;
	start: Vec3;
	end: Vec3;
	from: Vec3;
	to: Vec3;
}

export function bend(loop: Loop, corner: number, radius: number): Bend {
	const c = cyclic(loop.corners, corner);
	const incoming = cyclic(loop.segments, corner - 1).dir;
	const outgoing = cyclic(loop.segments, corner).dir;
	return {
		corner,
		radius,
		center: add(c, scale(sub(outgoing, incoming), radius)),
		start: sub(c, scale(incoming, radius)),
		end: add(c, scale(outgoing, radius)),
		from: neg(outgoing),
		to: incoming,
	};
}

export function bendPoint(b: Bend, angle: number): Vec3 {
	return add(
		b.center,
		add(
			scale(b.from, b.radius * Math.cos(angle)),
			scale(b.to, b.radius * Math.sin(angle)),
		),
	);
}

export function straightRun(
	loop: Loop,
	index: number,
	radius: number,
): { start: Vec3; end: Vec3; length: number } {
	const s = cyclic(loop.segments, index);
	return {
		start: add(s.start, scale(s.dir, radius)),
		end: sub(s.end, scale(s.dir, radius)),
		length: s.length - 2 * radius,
	};
}

export const midpoint = (a: Vec3, b: Vec3): Vec3 => lerp(a, b, 0.5);
