#!/usr/bin/env node

import puppeteer from "puppeteer-core";

const b = await puppeteer.connect({
	browserURL: "http://localhost:9222",
	defaultViewport: null,
});

const p = (await b.pages()).at(-1);

if (!p) {
	console.error("✗ No active tab found");
	process.exit(1);
}

const cookies = await p.cookies();

for (const cookie of cookies) {
	console.log(`${cookie.name}: ${cookie.value}`);
	console.log(`  domain: ${cookie.domain}`);
	console.log(`  path: ${cookie.path}`);
	console.log(`  httpOnly: ${cookie.httpOnly}`);
	console.log(`  secure: ${cookie.secure}`);
	console.log("");
}

await b.disconnect();
