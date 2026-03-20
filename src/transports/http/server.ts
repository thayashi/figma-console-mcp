import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import type { FigmaRuntime } from "../../daemon/runtime.js";
import { createToolContext, type ToolRegistry } from "../../tools/registry.js";
import type { ToolInvokeOptions } from "../../tools/types.js";

export interface HttpServerOptions {
	host?: string;
	port: number;
	runtime: FigmaRuntime;
	registry: ToolRegistry;
}

interface ToolInvokeRequestBody {
	input?: unknown;
	options?: ToolInvokeOptions;
}

export function createHttpHandler(options: HttpServerOptions) {
	const { runtime, registry } = options;

	return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
		const method = req.method || "GET";
		const url = new URL(req.url || "/", "http://127.0.0.1");

		if (method === "GET" && url.pathname === "/v1/health") {
			return writeJson(res, 200, { ok: true });
		}

		if (method === "GET" && url.pathname === "/v1/status") {
			const status = await runtime.getStatus();
			return writeJson(res, 200, status);
		}

		if (method === "GET" && url.pathname === "/v1/tools") {
			return writeJson(res, 200, { tools: registry.describeAll() });
		}

		if (method === "GET" && url.pathname === "/v1/help") {
			return writeJson(res, 200, buildHelpDocument(registry));
		}

		if (method === "GET" && url.pathname === "/v1/openapi.json") {
			return writeJson(res, 200, buildOpenApiDocument(registry));
		}

		if (method === "GET" && url.pathname.startsWith("/v1/tools/")) {
			const toolName = decodeURIComponent(url.pathname.replace("/v1/tools/", ""));
			const tool = registry.describe(toolName);

			if (!tool) {
				return writeJson(res, 404, {
					ok: false,
					error: {
						code: "TOOL_NOT_FOUND",
						message: `Unknown tool: ${toolName}`,
					},
				});
			}

			return writeJson(res, 200, tool);
		}

		if (method === "POST" && url.pathname.startsWith("/v1/tools/")) {
			const toolName = decodeURIComponent(url.pathname.replace("/v1/tools/", ""));
			const payload = (await readJsonBody(req)) as ToolInvokeRequestBody;
			const ctx = createToolContext(runtime, "http", randomUUID(), false);
			const result = await registry.invoke(
				toolName,
				ctx,
				payload?.input,
				payload?.options,
			);

			return writeJson(res, result.ok ? 200 : 400, result);
		}

		writeJson(res, 404, {
			ok: false,
			error: {
				code: "NOT_FOUND",
				message: `No route for ${method} ${url.pathname}`,
			},
		});
	};
}

export function startHttpServer(options: HttpServerOptions) {
	const server = createServer((req, res) => {
		void createHttpHandler(options)(req, res).catch((error) => {
			writeJson(res, 500, {
				ok: false,
				error: {
					code: "HTTP_HANDLER_FAILED",
					message: error instanceof Error ? error.message : String(error),
				},
			});
		});
	});

	return new Promise<{ server: ReturnType<typeof createServer>; port: number }>((resolve, reject) => {
		const host = options.host || "127.0.0.1";
		server.once("error", reject);
		server.listen(options.port, host, () => {
			server.off("error", reject);
			const address = server.address();
			if (typeof address === "string" || !address) {
				resolve({ server, port: options.port });
				return;
			}
			resolve({ server, port: address.port });
		});
	});
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
	const chunks: Buffer[] = [];

	for await (const chunk of req) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}

	if (chunks.length === 0) {
		return {};
	}

	return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function writeJson(res: ServerResponse, statusCode: number, data: unknown): void {
	res.statusCode = statusCode;
	res.setHeader("Content-Type", "application/json; charset=utf-8");
	res.end(JSON.stringify(data, null, 2));
}

function buildOpenApiDocument(registry: ToolRegistry): unknown {
	const paths: Record<string, unknown> = {
		"/v1/health": {
			get: {
				summary: "Daemon health check",
			},
		},
		"/v1/status": {
			get: {
				summary: "Runtime connection status",
			},
		},
		"/v1/tools": {
			get: {
				summary: "List all discoverable tools",
			},
		},
		"/v1/help": {
			get: {
				summary: "Agent-oriented discovery and usage guide",
			},
		},
	};

	for (const tool of registry.describeAll()) {
		paths[`/v1/tools/${tool.name}`] = {
			get: {
				summary: tool.summary,
				description: tool.description,
			},
			post: {
				summary: `Invoke ${tool.name}`,
				description: tool.description,
			},
		};
	}

	return {
		openapi: "3.1.0",
		info: {
			title: "Figma Console Local API",
			version: "0.1.0",
		},
		paths,
	};
}

function buildHelpDocument(registry: ToolRegistry): unknown {
	const toolNames = registry.describeAll().map((tool) => tool.name);

	return {
		service: "Figma Console Local API",
		version: "0.1.0",
		discoveryFlow: [
			"Call GET /v1/tools to list available tools.",
			"Call GET /v1/tools/:name to inspect schema, examples, and capability flags.",
			"Call POST /v1/tools/:name with an input object to execute a tool.",
		],
		recommendations: [
			"Start with read-only discovery tools before write tools.",
			"Prefer the active Desktop Bridge file when available for plugin-backed reads.",
			"Use specific file URLs or library file keys for cross-file REST access.",
		],
		toolNames,
		examples: {
			listTools: {
				method: "GET",
				path: "/v1/tools",
			},
			showTool: {
				method: "GET",
				path: "/v1/tools/figma_get_variables",
			},
			invokeTool: {
				method: "POST",
				path: "/v1/tools/figma_search_components",
				body: {
					input: {
						query: "Button",
						limit: 10,
					},
				},
			},
		},
	};
}
