import { defineConfig } from "astro/config";

export default defineConfig({
	site: "https://cedric-ruiu.github.io",
	base: "/loopcube",
	trailingSlash: "always",
	build: { format: "directory", inlineStylesheets: "always" },
});
