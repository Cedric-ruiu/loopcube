import {
	BufferGeometry,
	CylinderGeometry,
	EdgesGeometry,
	Float32BufferAttribute,
	Group,
	type LineBasicMaterial,
	LineSegments,
	Matrix4,
	Mesh,
	type MeshLambertMaterial,
	TorusGeometry,
	Vector3,
} from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import {
	type Bend,
	bend,
	buildLoop,
	type Design,
	type Loop,
	markAnchors,
	midpoint,
	mitredBar,
	type Part,
	parts,
	straightRun,
	type Vec3,
} from "../geometry";

export type MarkDisplay = "none" | "type" | "piece";

export interface ModelStyle {
	colors: boolean;
	marks: MarkDisplay;
}

export interface Materials {
	metal: MeshLambertMaterial;
	parts: (index: number) => MeshLambertMaterial;
	weld: MeshLambertMaterial;
	edge: LineBasicMaterial;
}

export interface Model {
	group: Group;
	dispose(): void;
}

const ROUND_SEGMENTS = 32;
const BEND_SEGMENTS = 16;
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);

const v3 = (v: Vec3): Vector3 => new Vector3(v[0], v[1], v[2]);

/** Closed convex solid from the 8 corners of a mitred bar, faces turned outwards. */
function mitredGeometry({
	start,
	end,
}: {
	start: Vec3[];
	end: Vec3[];
}): BufferGeometry {
	const corners = [...start, ...end].map(v3);
	const center = corners
		.reduce((sum, c) => sum.add(c), new Vector3())
		.divideScalar(corners.length);
	const s = corners.slice(0, 4);
	const e = corners.slice(4);
	const faces = [
		s,
		e,
		...s.map((a, k) => [
			a,
			s[(k + 1) % 4] ?? a,
			e[(k + 1) % 4] ?? a,
			e[k] ?? a,
		]),
	];
	const positions: number[] = [];
	for (const face of faces) {
		const [a, b, c] = face as [Vector3, Vector3, Vector3, Vector3];
		const normal = new Vector3()
			.subVectors(b, a)
			.cross(new Vector3().subVectors(c, a));
		const quad =
			normal.dot(new Vector3().subVectors(a, center)) > 0
				? face
				: [...face].reverse();
		for (const k of [0, 1, 2, 0, 2, 3]) {
			const p = quad[k] as Vector3;
			positions.push(p.x, p.y, p.z);
		}
	}
	const geometry = new BufferGeometry();
	geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
	geometry.computeVertexNormals();
	return geometry;
}

export function buildModel(
	design: Design,
	style: ModelStyle,
	materials: Materials,
): Model {
	const loop = buildLoop(design);
	const group = new Group();
	const geometries: BufferGeometry[] = [];
	const labels: HTMLElement[] = [];
	const radius = design.width / 2;
	const bendRadius =
		design.profile.shape === "round" ? design.profile.bendRadius : 0;

	const keep = <T extends BufferGeometry>(g: T): T => {
		geometries.push(g);
		return g;
	};
	const mark = (part: Part, piece: number, at: Vec3 | undefined) => {
		if (style.marks === "none" || !at) return;
		const label = document.createElement("span");
		label.className = "lc-mark";
		label.textContent =
			(style.marks === "piece" ? part.marks[piece] : undefined) ?? part.id;
		labels.push(label);
		const object = new CSS2DObject(label);
		object.position.copy(v3(at));
		group.add(object);
	};

	const ring = keep(
		new TorusGeometry(radius * 1.04, radius * 0.07, 6, ROUND_SEGMENTS),
	);
	const weld = (at: Vec3, axis: Vec3) => {
		const mesh = new Mesh(ring, materials.weld);
		mesh.position.copy(v3(at));
		mesh.quaternion.setFromUnitVectors(Z, v3(axis));
		group.add(mesh);
	};

	const tube = (from: Vec3, to: Vec3, material: MeshLambertMaterial) => {
		const a = v3(from);
		const axis = v3(to).sub(a);
		const mesh = new Mesh(
			keep(
				new CylinderGeometry(
					radius,
					radius,
					axis.length(),
					ROUND_SEGMENTS,
					1,
					true,
				),
			),
			material,
		);
		mesh.position.copy(a.addScaledVector(axis, 0.5));
		mesh.quaternion.setFromUnitVectors(Y, axis.normalize());
		group.add(mesh);
	};

	let arc: TorusGeometry | null = null;
	const curve = (b: Bend, material: MeshLambertMaterial) => {
		arc ??= keep(
			new TorusGeometry(
				b.radius,
				radius,
				ROUND_SEGMENTS,
				BEND_SEGMENTS,
				Math.PI / 2,
			),
		);
		// The torus arc starts on +X and turns towards +Y around +Z.
		const from = v3(b.from);
		const to = v3(b.to);
		const mesh = new Mesh(arc, material);
		new Matrix4()
			.makeBasis(from, to, from.clone().cross(to))
			.setPosition(v3(b.center))
			.decompose(mesh.position, mesh.quaternion, mesh.scale);
		group.add(mesh);
	};

	for (const [index, part] of parts(design, loop).entries()) {
		const material = style.colors ? materials.parts(index) : materials.metal;
		const anchors = style.marks === "none" ? [] : markAnchors(part, loop);
		switch (part.kind) {
			case "bar":
				for (const [piece, i] of part.segments.entries()) {
					const geometry = keep(mitredGeometry(mitredBar(loop, i)));
					group.add(new Mesh(geometry, material));
					group.add(
						new LineSegments(keep(new EdgesGeometry(geometry)), materials.edge),
					);
					mark(part, piece, anchors[piece]);
				}
				break;
			case "tube":
				for (const [piece, i] of part.segments.entries()) {
					const run = straightRun(loop, i, bendRadius);
					tube(run.start, run.end, material);
					mark(part, piece, anchors[piece]);
				}
				break;
			case "elbow":
				for (const [piece, corner] of part.corners.entries()) {
					const b = bend(loop, corner, part.radius);
					curve(b, material);
					// b.to is the incoming direction, b.from the outgoing one reversed
					weld(b.start, b.to);
					weld(b.end, b.from);
					mark(part, piece, anchors[piece]);
				}
				break;
			case "section":
				for (const [piece, { segments }] of part.sections.entries()) {
					segments.forEach((i, k) => {
						const run = straightRun(loop, i, bendRadius);
						const middle = segmentMiddle(loop, i);
						const first = k === 0;
						const last = k === segments.length - 1;
						tube(first ? middle : run.start, last ? middle : run.end, material);
						if (!first) curve(bend(loop, i, bendRadius), material);
					});
					const cut = segments[0] ?? 0;
					weld(segmentMiddle(loop, cut), loop.segments[cut]?.dir ?? [1, 0, 0]);
					mark(part, piece, anchors[piece]);
				}
				break;
		}
	}

	return {
		group,
		dispose() {
			for (const g of geometries) g.dispose();
			for (const label of labels) label.remove();
		},
	};
}

function segmentMiddle(loop: Loop, index: number): Vec3 {
	const s = loop.segments[index];
	if (!s) throw new RangeError(`No segment ${index}`);
	return midpoint(s.start, s.end);
}
