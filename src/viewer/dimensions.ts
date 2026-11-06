import {
	BufferGeometry,
	ConeGeometry,
	Float32BufferAttribute,
	Group,
	type LineBasicMaterial,
	LineSegments,
	Mesh,
	type MeshBasicMaterial,
	Vector3,
} from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import type { Vec3 } from "../geometry";

export interface DimensionMaterials {
	line: LineBasicMaterial;
	arrow: MeshBasicMaterial;
}

export interface Dimensions {
	group: Group;
	/** Moves the dimensions onto the outline seen from `eye`. */
	orient(eye: Vector3): void;
	dispose(): void;
}

// In radii of the sphere around the object
const OFFSET = 0.2;
const OVERSHOOT = 0.04;
const GAP = 0.02;
const ARROW_LENGTH = 0.05;
const ARROW_RADIUS = 0.014;
const Y = new Vector3(0, 1, 0);

/**
 * Overall length, height and depth of the object, drawn for an eye in the
 * (+, +, +) octant, then mirrored towards the actual eye.
 */
export function buildDimensions(
	size: Vec3,
	format: (mm: number) => string,
	materials: DimensionMaterials,
): Dimensions {
	const [hx, hy, hz] = [size[0] / 2, size[1] / 2, size[2] / 2];
	const radius = Math.hypot(hx, hy, hz);
	const group = new Group();
	const height = new Group();
	group.add(height);
	const lines: number[] = [];
	const heightLines: number[] = [];
	const labels: HTMLElement[] = [];
	const cone = new ConeGeometry(
		radius * ARROW_RADIUS,
		radius * ARROW_LENGTH,
		12,
	);

	const segment = (target: number[], a: Vector3, b: Vector3) => {
		target.push(a.x, a.y, a.z, b.x, b.y, b.z);
	};

	const dimension = (
		parent: Group,
		target: number[],
		from: Vector3,
		to: Vector3,
		out: Vector3,
		length: number,
	) => {
		const offset = out.clone().normalize().multiplyScalar(radius);
		const at = (p: Vector3, k: number) => p.clone().addScaledVector(offset, k);
		segment(target, at(from, GAP), at(from, OFFSET + OVERSHOOT));
		segment(target, at(to, GAP), at(to, OFFSET + OVERSHOOT));
		const start = at(from, OFFSET);
		const end = at(to, OFFSET);
		segment(target, start, end);
		const along = end.clone().sub(start).normalize();
		for (const [tip, dir] of [
			[end, along],
			[start, along.clone().negate()],
		] as const) {
			const arrow = new Mesh(cone, materials.arrow);
			arrow.position
				.copy(tip)
				.addScaledVector(dir, (-radius * ARROW_LENGTH) / 2);
			arrow.quaternion.setFromUnitVectors(Y, dir);
			parent.add(arrow);
		}
		const label = document.createElement("span");
		label.className = "lc-dim";
		label.textContent = format(length);
		labels.push(label);
		const object = new CSS2DObject(label);
		object.position.copy(start).lerp(end, 0.5);
		parent.add(object);
	};

	dimension(
		group,
		lines,
		new Vector3(-hx, -hy, hz),
		new Vector3(hx, -hy, hz),
		new Vector3(0, -1, 1),
		size[0],
	);
	dimension(
		group,
		lines,
		new Vector3(hx, -hy, hz),
		new Vector3(hx, -hy, -hz),
		new Vector3(1, -1, 0),
		size[2],
	);
	dimension(
		height,
		heightLines,
		new Vector3(hx, -hy, -hz),
		new Vector3(hx, hy, -hz),
		new Vector3(1, 0, -1),
		size[1],
	);

	const geometries: BufferGeometry[] = [cone];
	for (const [parent, positions] of [
		[group, lines],
		[height, heightLines],
	] as const) {
		const geometry = new BufferGeometry();
		geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
		geometries.push(geometry);
		parent.add(new LineSegments(geometry, materials.line));
	}

	return {
		group,
		orient(eye) {
			const sx = Math.sign(eye.x) || 1;
			const sz = Math.sign(eye.z) || 1;
			group.scale.set(sx, Math.sign(eye.y) || 1, sz);
			// The height goes on the side of the outline away from the figure,
			// which stands towards +X −Z.
			const flip = sx * hx + sz * hz > 0 ? -1 : 1;
			height.scale.set(flip, 1, flip);
		},
		dispose() {
			for (const g of geometries) g.dispose();
			for (const label of labels) label.remove();
		},
	};
}
