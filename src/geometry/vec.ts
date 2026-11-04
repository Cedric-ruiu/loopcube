export type Vec3 = readonly [number, number, number];
export type Axis = 0 | 1 | 2;

export const AXES: readonly Axis[] = [0, 1, 2];

export const map3 = (
	v: Vec3,
	f: (value: number, axis: Axis) => number,
): Vec3 => [f(v[0], 0), f(v[1], 1), f(v[2], 2)];

export const add = (a: Vec3, b: Vec3): Vec3 => map3(a, (v, i) => v + b[i]);
export const sub = (a: Vec3, b: Vec3): Vec3 => map3(a, (v, i) => v - b[i]);
export const scale = (a: Vec3, k: number): Vec3 => map3(a, (v) => v * k);
export const neg = (a: Vec3): Vec3 => map3(a, (v) => -v);
export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 =>
	map3(a, (v, i) => v + (b[i] - v) * t);
export const dot = (a: Vec3, b: Vec3): number =>
	a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
	a[1] * b[2] - a[2] * b[1],
	a[2] * b[0] - a[0] * b[2],
	a[0] * b[1] - a[1] * b[0],
];
export const unitAxis = (axis: Axis, sign: number): Vec3 =>
	map3([0, 0, 0], (_, i) => (i === axis ? Math.sign(sign) : 0));

export function cyclic<T>(items: readonly T[], index: number): T {
	const item = items[((index % items.length) + items.length) % items.length];
	if (item === undefined) throw new RangeError("Empty list");
	return item;
}
