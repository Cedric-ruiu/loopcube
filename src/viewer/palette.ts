/**
 * One colour per part type (a box has up to 11), ordered so that the first
 * ones differ the most, and still apart once shaded by the 3D lighting.
 */
export const PART_COLORS = [
	"#42d4f4",
	"#be0032",
	"#f3c300",
	"#117733",
	"#604e97",
	"#ff7f0e",
	"#e68fac",
	"#0072b2",
	"#f032e6",
	"#44aa99",
	"#8db600",
	"#8c564b",
] as const;

export const METAL = "#b4bac2";
export const WELD = "#3d4249";
export const EDGE = "#1b1f24";
/** Mid-tone, readable on the light and the dark background */
export const DIMENSION = "#6e7781";
export const FIGURE = {
	suit: "#575c45",
	fold: "#6b7058",
	flap: "#464a35",
	seam: "#2f3326",
	skin: "#e4bca3",
	shade: "#d0a389",
	hair: "#24170f",
	curl: "#120b07",
	gloss: "#5a3e2e",
	shirt: "#e9e5da",
	patch: "#7a3b32",
	badge: "#c9a24a",
	shoe: "#ebe7de",
	sole: "#c2bdb0",
	lace: "#9d978a",
	board: "#dcd8cf",
	rim: "#111111",
} as const;

export const partColor = (index: number): string =>
	PART_COLORS[index % PART_COLORS.length] ?? METAL;
