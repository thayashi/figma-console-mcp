import { Readable } from "node:stream";
import { createHttpHandler } from "../src/transports/http/server";

function createRequest(method: string, url: string, body?: unknown) {
	const raw = body === undefined ? "" : JSON.stringify(body);
	const req = Readable.from(raw ? [raw] : []) as Readable & {
		method?: string;
		url?: string;
	};
	req.method = method;
	req.url = url;
	return req as any;
}

function createResponse() {
	let payload = "";
	const headers = new Map<string, string>();

	return {
		res: {
			statusCode: 200,
			setHeader: (name: string, value: string) => {
				headers.set(name, value);
			},
			end: (chunk?: string) => {
				payload = chunk || "";
			},
		} as any,
		readJson: () => JSON.parse(payload),
		readHeader: (name: string) => headers.get(name),
	};
}

describe("HTTP convenience aliases", () => {
	it("routes POST /v1/execute to figma_execute with a direct input body", async () => {
		const registry = {
			describeAll: () => [],
			invoke: jest.fn().mockResolvedValue({
				ok: true,
				tool: "figma_execute",
				data: { ok: true },
				meta: {
					requestId: "req_123",
					transport: "http",
					durationMs: 1,
					warnings: [],
				},
			}),
		};

		const handler = createHttpHandler({
			host: "127.0.0.1",
			port: 3847,
			runtime: {} as any,
			registry: registry as any,
		});
		const req = createRequest("POST", "/v1/execute", {
			code: "return { ok: true };",
			timeout: 5000,
		});
		const { res, readJson, readHeader } = createResponse();

		await handler(req, res);
		const body = readJson();

		expect(res.statusCode).toBe(200);
		expect(readHeader("Content-Type")).toContain("application/json");
		expect(body.tool).toBe("figma_execute");
		expect(registry.invoke).toHaveBeenCalledWith(
			"figma_execute",
			expect.objectContaining({
				request: expect.objectContaining({
					transport: "http",
				}),
			}),
			{
				code: "return { ok: true };",
				timeout: 5000,
			},
			undefined,
		);
	});

	it("routes POST /v1/screenshot to figma_capture_screenshot with the standard envelope", async () => {
		const registry = {
			describeAll: () => [],
			invoke: jest.fn().mockResolvedValue({
				ok: true,
				tool: "figma_capture_screenshot",
				data: { success: true },
				meta: {
					requestId: "req_456",
					transport: "http",
					durationMs: 1,
					warnings: [],
				},
			}),
		};

		const handler = createHttpHandler({
			host: "127.0.0.1",
			port: 3847,
			runtime: {} as any,
			registry: registry as any,
		});
		const req = createRequest("POST", "/v1/screenshot", {
			input: {
				nodeId: "123:456",
				format: "PNG",
				scale: 2,
			},
			options: {
				verbosity: "summary",
			},
		});
		const { res, readJson } = createResponse();

		await handler(req, res);
		const body = readJson();

		expect(res.statusCode).toBe(200);
		expect(body.tool).toBe("figma_capture_screenshot");
		expect(registry.invoke).toHaveBeenCalledWith(
			"figma_capture_screenshot",
			expect.objectContaining({
				request: expect.objectContaining({
					transport: "http",
				}),
			}),
			{
				nodeId: "123:456",
				format: "PNG",
				scale: 2,
			},
			{
				verbosity: "summary",
			},
		);
	});
});
