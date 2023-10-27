import EmailFetcher from "./imap.js";
import { URLSearchParams } from "url";
import Queue from "better-queue";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";

const urlProcessingQueue = new Queue(
	async function (input, cb) {
		try {
			const result = await scrapeMetaAndArticle(input);
			console.log(`Displaying data for ${input}`);
			console.log(`Scraped meta tags (property):`, JSON.stringify(result.metaTags));

			console.log(`Scraped jsonLdScripts:`, JSON.stringify(result.jsonLdScripts));

			console.log(`Scraped article text:`, result.articleText);

			console.log("---------");
			setTimeout(() => cb(null, "success"), 5000); // 5-second delay
		} catch (err) {
			cb(err);
		}
	},
	{ concurrent: 1 }
);
async function scrapeMetaAndArticle(targetUrl) {
	const browser = await puppeteer.launch({
		headless: false,
		args: ["--headless"],
	});

	const page = await browser.newPage();

	try {
		await page.goto(targetUrl, { waitUntil: "load", timeout: 0 });
		await page.waitForSelector("body");

		const content = await page.content();
		const $ = cheerio.load(content);

		const metaTags = $("meta")
			.map((_, el) => ({
				property: $(el).attr("property"),
				itemprop: $(el).attr("itemprop"),
				name: $(el).attr("name"),
				content: $(el).attr("content"),
			}))
			.get();

		const jsonLdScripts = await page.$$eval('script[type="application/ld+json"]', (scripts) =>
			scripts.map((script) => JSON.parse(script.innerText))
		);

		const articleText = await page.$$eval("p", (paragraphs) => paragraphs.map((p) => p.innerText).join(" "));

		await browser.close();

		return {
			metaTags,
			jsonLdScripts,
			articleText,
		};
	} catch (error) {
		console.log(`Visiting URL ${targetUrl} failed with error: ${error}`);
		await browser.close();
		throw error;
	}
}

(async () => {
	const emailFetcher = new EmailFetcher();
	const emails = await emailFetcher.fetchEmails();

	emails.forEach((email) => {
		if (email.subject.includes("Google Alert")) GoogleAlerts(email);
	});
})();

const processedUrlsSet = new Set(); // Set to hold already processed URLs

async function GoogleAlerts(email) {
	const regex = /<https:\/\/www\.google\.com\/[^>]+>/g;

	const matches = email.body.match(regex);
	if (matches) {
		matches.forEach((match) => {
			const googleUrl = match.substring(1, match.length - 1);
			const searchParams = new URLSearchParams(googleUrl.split("?")[1]);
			const targetUrl = searchParams.get("url");
			if (targetUrl) {
				if (!processedUrlsSet.has(targetUrl)) {
					// Check if URL is already in the Set
					processedUrlsSet.add(targetUrl); // Add the URL to the Set

					urlProcessingQueue.push(targetUrl);
				} else {
					console.log(`Skipping ${targetUrl}, already in queue.`);
				}
			}
		});
	} else {
		console.error("No URLs found");
	}
}
