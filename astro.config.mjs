import { defineConfig, fontProviders } from "astro/config";

export default defineConfig({
	site: "https://cedric-ruiu.github.io",
	base: "/loopcube",
	trailingSlash: "always",
	build: { format: "directory", inlineStylesheets: "always" },
	fonts: [
		{
			// Barlow SemiBold, subset to Latin-1 and French punctuation
			provider: fontProviders.local(),
			name: "Barlow",
			cssVariable: "--font-barlow",
			fallbacks: ["sans-serif"],
			options: {
				variants: [
					{
						src: ["./src/assets/fonts/barlow-600.woff2"],
						weight: 600,
						style: "normal",
						display: "swap",
						unicodeRange: [
							"U+0020-007E, U+00A0-00FF, U+0152-0153, U+0178, U+2009, U+2013-2014, U+2018-201E, U+2022, U+2026, U+2032-2033, U+20AC, U+2212",
						],
					},
				],
			},
		},
	],
});
