import type { Messages } from "./fr";

export const en: Messages = {
	langName: "English",
	meta: {
		title:
			"LoopCube — Impossible cube generator for metal fabrication, free cut list",
		description:
			"Design an impossible cube in square or round tube: live 3D preview, printable welding project plans and cut list. A free tool for metal fabricators.",
		imageAlt:
			"3D render of an impossible cube in square tube, parts colored by type",
	},
	root: {
		tagline: "Impossible cube generator for metal fabrication",
	},
	home: {
		anchor: "generator",
		h1: "Impossible cube generator for metal fabrication",
		lead: "Classic cube, framed cube or coffee table: set it to your stock, check it in 3D, print the cut list.",
		plan: {
			title: "Plans ready for the shop floor",
			text: "Three A4 sheets drawn to ASME Y14.5 in third-angle projection, dimensioned in fractional inches to 1/16″ or in millimeters. A 4″ check bar on every sheet confirms the print scale.",
			sheets: [
				{
					title: "General view",
					text: "Front, top and side views with dimensions, plus an axonometric view marking every part.",
					alt: "Sheet 1 of the plans: large marked axonometric view of a 12-inch impossible cube in square tube, three dimensioned views, a section detail of the gap between two bars, the diagonal view and the loop sequence",
				},
				{
					title: "Bill of materials",
					text: "Quantities, cut lengths and the total stock to order.",
					alt: "Sheet 2 of the plans: bill of materials table, fabrication notes and the dimensioned sketch of the 12 U-shaped bars, with their end view at full scale",
				},
				{
					title: "Cut list",
					text: "Every part type dimensioned, with its miters and their orientation.",
					alt: "Sheet 3 of the plans: dimensioned sketches of the right-hand and left-hand twisted bars, with their end views at full scale",
				},
			],
		},
		line: {
			title: "One line, no start, no end",
			text: "An impossible cube, also called an infinite cube sculpture, is a single line of tube that closes on itself while tracing the edges of a cube. Seen along its long diagonal, it looks drawn in one unbroken stroke: six triangular lobes around a star. It also comes as a framed cube, whose top and bottom are full-size frames, and as a long box for a coffee table. Not to be confused with the folding “infinity cube” fidget toy.",
			figures: [
				{ value: "18", label: "straight runs" },
				{ value: "18", label: "square corners" },
				{ value: "6", label: "doubled edges" },
				{ value: "6", label: "single edges" },
			],
			note: "No bar touches another except at its two welded corners.",
		},
		steps: {
			title: "How to use it",
			items: [
				{
					title: "Pick the shape and the stock",
					text: "Classic cube, framed cube or a long box for a coffee table; then the tube, square or round, in a standard size or a custom one, with its wall thickness.",
				},
				{
					title: "Set the size",
					text: "The edge and the gap between bars, plus the length of a box. For round tube: weld elbows or bent tube, then the bend radius.",
				},
				{
					title: "Check it in 3D",
					text: "Rotate it, then switch to “Diagonal view” to see the endless-line illusion.",
				},
				{
					title: "Print the plans",
					text: "The “Print plans (A4)” button opens the print dialog; pick PDF to save them.",
				},
			],
		},
		trades: {
			title: "Metal fabrication and welding",
			text: "A good precision exercise: miter cuts, gaps between bars and weld alignment all show.",
			audience:
				"For metal fabricators, pipe fitters, ironworkers and welders, apprentices and their instructors, and hobbyists with a welder at home.",
			action: "Set up my cube",
		},
	},
	langSwitch: {
		label: "Language",
	},
	nav: {
		skip: "Skip to the generator",
		home: "LoopCube home",
	},
	footer: {
		tagline:
			"Impossible cube generator in square or round tube, with a printable fabrication plan. Free, no account: everything is computed in your browser, your dimensions never leave it.",
		contactTitle: "A word?",
		contactText:
			"A dimension that doesn’t add up, a tube size missing from the list, or a cube welded from this plan? Write to me, a photo is always welcome.",
		contactCta: "Send an email",
		contactSubject: "LoopCube — question or feedback",
		copyEmail: "Copy",
		copySuccess: "Address copied",
		share: "Share LoopCube",
		shareCopied: "Link copied",
		contributeTitle: "Contribute",
		openSource:
			"Open source project under the MIT license. Fixes and ideas welcome.",
		issues: "Report a bug or suggest an idea",
		credit:
			"Made by {name}, metal fabricator in training and freelance web developer ({site}).",
		privacy:
			"Anonymous, cookieless audience measurement (Umami): page views and tool usage, never your dimensions.",
	},
	notFound: {
		title: "Page not found",
		text: "This address does not lead to any LoopCube page.",
		link: "Go to the impossible cube generator",
	},
	params: {
		edge: "Cube edge",
		length: "Length",
		depth: "Depth",
		width: "Profile width",
		gap: "Gap between bars",
		wall: "Wall thickness",
		bendRadius: "Bend radius",
	},
	issues: {
		notPositive: "{param} must be greater than zero.",
		wallTooThick: "Wall thickness cannot exceed half the width ({limit}).",
		bendRadiusTooSmall: "Bend radius must be at least one diameter ({limit}).",
		straightTooShort:
			"Too small for this profile: a straight run would get too short. {param}: {limit} minimum.",
		lengthTooShort: "Length must be at least the depth ({limit}).",
	},
	limits: {
		straight: "Limit reached: the shortest straight run is down to {min}.",
		solid:
			"Limit reached: the wall is half the width, which makes a solid bar.",
		radius: "Limit reached: the radius can't go below one diameter.",
		length: "Limit reached: length equals depth.",
	},
	ui: {
		settings: "Settings",
		unit: "Units",
		units: { mm: "mm", in: "inches" },
		pattern: "Shape",
		patterns: {
			cube: "Classic cube",
			framed: "Framed cube",
			box: "Box (coffee table)",
		},
		patternHints: {
			cube: "The original impossible cube: six identical faces.",
			framed:
				"Top and bottom are full-size frames, flush with the edges: ready to take a top.",
			box: "The framed cube, stretched: set its length, depth and height, for a coffee table for instance.",
		},
		edge: { cube: "Cube edge", framed: "Cube edge", box: "Height" },
		profile: "Profile",
		shapes: { square: "Square tube", round: "Round tube" },
		joint: "Corners",
		joints: { elbow: "Weld elbows", bent: "Bent tube" },
		section: "Standard size",
		custom: "Custom",
		width: { square: "Tube width", round: "Outside diameter" },
		gapAuto: { square: "Auto (½ width)", round: "Auto (½ OD)" },
		radiusAuto: "Auto (1.5 × OD)",
		blocked: "{option} unavailable. {reason}",
		sizesBlocked: "Grayed-out sizes don't fit this cube.",
		notANumber: "Unrecognized value. Example: {example}.",
		range: "Possible values with these settings: {min} to {max}.",
		rangeFrom: "Minimum with these settings: {min}.",
	},
	viewer: {
		label: "3D view of the impossible cube",
		loading: "Loading 3D…",
		unavailable: "3D view unavailable: this browser doesn't support WebGL.",
		diagonal: "Diagonal view",
		colors: "Color by type",
		human: "5 ft 11½ in person",
		marks: "Part marks",
		markDisplays: { none: "none", type: "by part", piece: "by piece" },
		help: "Drag to rotate, scroll or pinch to zoom",
		legend: "Parts to cut",
	},
	parts: {
		bar: {
			"same-side": "Bar, miters on the same side (U)",
			opposite: "Bar, opposite miters",
			right: "Bar, miters at 90°, right-hand twist",
			left: "Bar, miters at 90°, left-hand twist",
		},
		tube: "Straight tube",
		elbow: "90° elbow",
		section: "Bent section, {bends} bends",
		axis: "{length} centerline",
		radius: "R {radius}",
		developed: "{length} developed",
	},
	plan: {
		button: "Print plans (A4)",
		loading: "Preparing the plans…",
		standard: "asme",
		file: "LoopCube - fabrication plans",
		title: {
			cube: "LoopCube — Impossible cube",
			framed: "LoopCube — Framed impossible cube",
			box: "LoopCube — Impossible box",
		},
		subtitle: "Fabrication drawing",
		sheets: {
			overview: "General view",
			bom: "Bill of materials",
			cutting: "Cut list",
		},
		block: {
			params: "Parameters",
			date: "Date",
			unit: "Units",
			scale: "Scale",
			tolerance: "Tolerances",
			projection: "Projection",
			standard: "Standard",
			page: "Sheet",
		},
		units: { mm: "mm", in: "inch" },
		unitNote: {
			mm: "Dimensions in millimeters.",
			in: 'Dimensions in inches, to 1/16".',
		},
		standardName: "ASME Y14.5",
		projectionName: "Third angle",
		tolerance: {
			mm: "±1.5 mm, angles ±1°",
			in: 'Fractions ±1/16", angles ±1°',
		},
		asNoted: "as noted",
		notToScale: "not to scale",
		unrolledScale: "NTS",
		printAt: "Print at 100% scale",
		checkBar: "this bar must measure {length}",
		credit: "Made with LoopCube by Cédric Ruiu",
		scaleLabel: "Scale {scale}",
		views: {
			front: "Front view",
			top: "Top view",
			left: "Left view",
			right: "Right view",
			axo: "Axonometric view, part marks",
			diagonal: "Diagonal view",
		},
		weld: {
			square: "{count} corners",
			elbow: "{count} joints",
			bent: "{count} joints",
		},
		sequence: {
			title: "Loop sequence",
			pattern: "Repeating pattern:",
			note: "Order of the pieces around the closed loop: not an assembly order.",
		},
		auxiliary: "Dimensions in parentheses are reference dimensions.",
		detail: "Detail X, section (scale {scale})",
		elbows: "{mark}: {count} identical elbows, one at each corner.",
		paramsLine: "{size} · {section} · G = {gap}",
		size: "A = {edge}",
		boxSize: "A = {edge} · B = {length} · C = {depth}",
		radiusParam: "R = {radius}",
		bom: {
			mark: "Item",
			qty: "Qty",
			designation: "Description",
			stock: "Stock",
			pieces: "Pieces",
			cut: "Cut length",
			total: "Total length",
			bought: "purchased",
			material: "Total stock",
			materialNote:
				"Total length of stock, saw kerf and offcuts not included: allow extra.",
		},
		notes: {
			title: "Notes",
			size: {
				cube: "A: cube edge (overall size)",
				box: "A: overall height · B: overall length · C: overall depth",
			},
			symbols:
				"{size} · W: tube width or OD · G: gap between two neighboring parallel bars, measured perpendicular to a cube face · L: centerline length, corner to corner.",
			radius: "R: bend or elbow radius, at the tube centerline.",
			square:
				"18 bars mitered at 45° on both ends, butt welded at the 18 corners.",
			elbow: "18 tubes cut square and 18 90° elbows, butt welded.",
			bent: "{count} flat bent sections, joined by {count} butt welds in the middle of the runs on single edges.",
			closure:
				"Squareness of the corners is critical: the errors of the {count} welds add up where the loop closes.",
			closureBent:
				"Squareness of the bends is critical: the errors of the {bends} bends and {count} welds add up where the loop closes.",
			flush: "Welds ground flush for a continuous line (optional).",
			marks: "Part marks (A1, A2…) match the axonometric view and the 3D view.",
		},
		card: {
			heading: "Item {id} · {qty} pieces · {designation}",
			piece: "Pieces",
			stock: "Stock",
			end: "End {n}",
		},
		bar: {
			axis: "Centerline length (L)",
			outside: "Tip to tip (L + W)",
			inside: "Inside (L − W)",
			mitres: "Miters",
			mitreValue: "45° on both ends",
			orientation: "Miter orientation",
			orientations: {
				"same-side": "same side (0°)",
				opposite: "opposite (180°)",
				right: "rotated 90°, clockwise",
				left: "rotated 90°, counterclockwise",
			},
			endView: "View from end 1",
			endViewNote:
				"Arrows: short side (inside of the corner) of the miter at each end.",
			views: { front: "Front", top: "Top" },
		},
		tube: {
			cut: "Cut length (L − 2R)",
			ends: "Square cut on both ends",
			endView: "End view",
		},
		elbow: {
			radius: "Centerline radius (R)",
			diameter: "OD",
			angle: "Angle",
			kind: "Purchased butt-weld elbow",
		},
		section: {
			developed: "Developed length (centerline)",
			radius: "Bend radius (R)",
			shape: "Section shape (flat), centerline dimensions",
			unrolled: "Layout, dimensions from end 1",
			bends: "Bends",
			bend: "Bend",
			start: "Start",
			finish: "End",
			angle: "Angle",
			twist: "Rotation",
			first: "—",
			welds: "Joining the sections",
			weld: "{from} → {to}",
			twistNote:
				"Tube rotation since the previous bend; positive clockwise, looking along the tube from end 1 to end 2.",
			grip: "Allow extra length for the bender grip, trim after bending.",
		},
	},
};
