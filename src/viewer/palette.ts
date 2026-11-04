/** Okabe–Ito colours, told apart with the common colour vision deficiencies. */
const PART_COLORS = [
	"#0072b2",
	"#e69f00",
	"#009e73",
	"#cc79a7",
	"#56b4e9",
	"#d55e00",
] as const;

export const METAL = "#b4bac2";
export const WELD = "#3d4249";
export const EDGE = "#1b1f24";
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
