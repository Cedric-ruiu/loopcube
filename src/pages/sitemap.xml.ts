import type { APIRoute } from "astro";
import { localePath, locales, rootPath } from "../i18n";

export const GET: APIRoute = ({ site }) => {
	const absolute = (path: string) => new URL(path, site).href;
	const alternates = [
		...locales.map((l) => [l, localePath(l)] as const),
		["x-default", rootPath()] as const,
	]
		.map(
			([hreflang, path]) =>
				`<xhtml:link rel="alternate" hreflang="${hreflang}" href="${absolute(path)}"/>`,
		)
		.join("");
	const urls = [rootPath(), ...locales.map(localePath)]
		.map((path) => `<url><loc>${absolute(path)}</loc>${alternates}</url>`)
		.join("\n");
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;
	return new Response(xml, {
		headers: { "Content-Type": "application/xml; charset=utf-8" },
	});
};
