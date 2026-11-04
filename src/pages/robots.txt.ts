import type { APIRoute } from "astro";

// Crawlers only read robots.txt at the host root; the sitemap is also submitted in Search Console.
export const GET: APIRoute = ({ site }) =>
	new Response(
		`User-agent: *\nAllow: /\n\nSitemap: ${new URL(`${import.meta.env.BASE_URL}sitemap.xml`, site).href}\n`,
		{ headers: { "Content-Type": "text/plain; charset=utf-8" } },
	);
