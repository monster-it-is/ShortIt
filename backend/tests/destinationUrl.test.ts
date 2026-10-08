import { describe, expect, it } from "vitest";
import { parseDestinationUrl } from "../src/lib/destinationUrl";

describe("parseDestinationUrl", () => {
	it("accepts http and https URLs", () => {
		expect(parseDestinationUrl("http://example.com")).toEqual({ url: "http://example.com" });
		expect(parseDestinationUrl("https://example.com/path?q=1#hash")).toEqual({
			url: "https://example.com/path?q=1#hash",
		});
		expect(parseDestinationUrl("  HTTPS://Example.COM/docs  ")).toEqual({
			url: "HTTPS://Example.COM/docs",
		});
		expect(parseDestinationUrl("http://localhost:3000/callback")).toEqual({
			url: "http://localhost:3000/callback",
		});
	});

	it("rejects javascript, data, file, and other unsupported protocols", () => {
		expect(parseDestinationUrl("javascript:alert(1)")).toEqual({
			message: "Only http and https URLs are allowed",
		});
		expect(parseDestinationUrl("JAVASCRIPT:alert(1)")).toEqual({
			message: "Only http and https URLs are allowed",
		});
		expect(parseDestinationUrl("data:text/html,<script>alert(1)</script>")).toEqual({
			message: "Only http and https URLs are allowed",
		});
		expect(parseDestinationUrl("file:///etc/passwd")).toEqual({
			message: "Only http and https URLs are allowed",
		});
		expect(parseDestinationUrl("ftp://files.example.com/a")).toEqual({
			message: "Only http and https URLs are allowed",
		});
		expect(parseDestinationUrl("blob:https://example.com/uuid")).toEqual({
			message: "Only http and https URLs are allowed",
		});
	});

	it("rejects malformed, missing, and empty URLs", () => {
		expect(parseDestinationUrl("")).toEqual({ message: "url is required" });
		expect(parseDestinationUrl("   ")).toEqual({ message: "url is required" });
		expect(parseDestinationUrl(undefined)).toEqual({ message: "url is required" });
		expect(parseDestinationUrl("example.com")).toEqual({
			message: "Enter a valid http or https URL",
		});
		expect(parseDestinationUrl("http://")).toEqual({
			message: "Enter a valid http or https URL",
		});
		expect(parseDestinationUrl("//example.com")).toEqual({
			message: "Enter a valid http or https URL",
		});
	});
});
