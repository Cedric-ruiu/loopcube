import {
	DirectionalLight,
	HemisphereLight,
	LineBasicMaterial,
	MeshLambertMaterial,
	OrthographicCamera,
	Quaternion,
	Scene,
	Vector3,
	WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { type Design, extents, type Vec3 } from "../geometry";
import { buildHuman, faceTowards, humanReach, standBeside } from "./human";
import { buildModel, type Model, type ModelStyle } from "./model";
import { EDGE, METAL, partColor, WELD } from "./palette";

export interface ViewOptions extends ModelStyle {
	human: boolean;
}

export interface Viewer {
	update(design: Design, options: ViewOptions): void;
	diagonalView(): void;
}

const START = new Vector3(0.55, 0.75, 1).normalize();
/** Half the visible size on the short side of the view, in radii of the framed sphere */
const FRAME = 1.2;
/** Camera distance, in radii of the sphere around the cube centre that holds the whole scene */
const DISTANCE = 4;
const MIN_ZOOM = 0.5;
const TRANSITION_MS = 600;

/** Lets the browser handle input and paint between the heavy start-up steps. */
const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const surface = {
	polygonOffset: true,
	polygonOffsetFactor: 1,
	polygonOffsetUnits: 1,
};

/** Renders only when something changed: no animation loop. */
export async function createViewer(
	stage: HTMLElement,
	design: Design,
	options: ViewOptions,
): Promise<Viewer> {
	await nextTask();
	const renderer = new WebGLRenderer({ antialias: true, alpha: true });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.domElement.classList.add("lc-canvas");
	const labels = new CSS2DRenderer();
	labels.domElement.classList.add("lc-labels");

	const scene = new Scene();
	const camera = new OrthographicCamera();
	camera.position.copy(START);
	scene.add(camera, new HemisphereLight(0xffffff, 0x5a6068, 1.6));
	// Lit from the upper left of the view, so that the three visible faces of
	// the diagonal view get three different shades.
	const light = new DirectionalLight(0xffffff, 2);
	light.position.set(-0.6, 1, 0.8);
	light.target.position.set(0, 0, -1);
	camera.add(light, light.target);

	const parts = new Map<number, MeshLambertMaterial>();
	const materials = {
		metal: new MeshLambertMaterial({ color: METAL, ...surface }),
		parts: (index: number) => {
			let material = parts.get(index);
			if (!material) {
				material = new MeshLambertMaterial({
					color: partColor(index),
					...surface,
				});
				parts.set(index, material);
			}
			return material;
		},
		weld: new MeshLambertMaterial({ color: WELD }),
		edge: new LineBasicMaterial({ color: EDGE }),
	};

	const controls = new OrbitControls(camera, renderer.domElement);
	controls.enablePan = false;
	controls.minZoom = MIN_ZOOM;
	controls.maxZoom = 8;

	await nextTask();
	const human = buildHuman(materials.edge);
	scene.add(human);

	let pending = 0;
	const draw = () => {
		cancelAnimationFrame(pending);
		pending = 0;
		if (human.visible) faceTowards(human, camera.position);
		renderer.render(scene, camera);
		labels.render(scene, camera);
	};
	const requestDraw = () => {
		if (!pending) pending = requestAnimationFrame(draw);
	};

	/** Outer size of the object along X, Y and Z */
	let size: Vec3 = [0, 0, 0];
	/** Radius of the sphere framed at zoom 1: the object's */
	let radius = 0;
	/** Radius of the sphere that holds the cube, and the figure when shown */
	let reach = 0;
	let model: Model | null = null;

	const resize = () => {
		const { clientWidth: width, clientHeight: height } = stage;
		if (!width || !height || !radius) return;
		renderer.setSize(width, height, false);
		labels.setSize(width, height);
		const half = radius * FRAME;
		const aspect = width / height;
		camera.left = -half * Math.max(aspect, 1);
		camera.right = -camera.left;
		camera.top = half * Math.max(1 / aspect, 1);
		camera.bottom = -camera.top;
		camera.near = reach * (DISTANCE - 2);
		camera.far = reach * (DISTANCE + 2);
		camera.updateProjectionMatrix();
	};

	const frame = (withHuman: boolean) => {
		const body = Math.hypot(...size) / 2;
		const all = withHuman ? Math.max(body, humanReach(human)) : body;
		if (body === radius && all === reach) return;
		radius = body;
		reach = all;
		controls.minZoom = Math.min(MIN_ZOOM, radius / reach);
		camera.zoom = Math.max(camera.zoom, controls.minZoom);
		camera.position.setLength(reach * DISTANCE);
		controls.update();
		resize();
	};

	const show = (design: Design, options: ViewOptions) => {
		if (model) {
			scene.remove(model.group);
			model.dispose();
		}
		model = buildModel(design, options, materials);
		scene.add(model.group);
		human.visible = options.human;
		size = extents(design);
		standBeside(human, size);
		frame(options.human);
	};

	await nextTask();
	show(design, options);
	await nextTask();
	await renderer.compileAsync(scene, camera);
	// Listening earlier would draw before the shaders are ready, blocking on their compilation
	controls.addEventListener("change", requestDraw);
	stage.append(renderer.domElement, labels.domElement);
	new ResizeObserver(() => {
		resize();
		draw();
	}).observe(stage);

	return {
		update(design, options) {
			show(design, options);
			draw();
		},

		diagonalView() {
			const from = camera.position.clone();
			const zoom = camera.zoom;
			// Through the corners where the doubled edges meet
			const diagonal = new Vector3(...size).normalize();
			const turn = new Quaternion().setFromUnitVectors(
				from.clone().normalize(),
				diagonal,
			);
			const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
			const duration = reduced ? 0 : TRANSITION_MS;
			const start = performance.now();
			const step = (now: number) => {
				const t = duration ? Math.min(1, (now - start) / duration) : 1;
				const k = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
				camera.position
					.copy(from)
					.applyQuaternion(new Quaternion().slerp(turn, k));
				camera.zoom = zoom + (1 - zoom) * k;
				camera.updateProjectionMatrix();
				controls.update();
				requestDraw();
				if (t < 1) requestAnimationFrame(step);
			};
			requestAnimationFrame(step);
		},
	};
}
