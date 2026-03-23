import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import type { FigmaRuntime } from "../../daemon/runtime.js";
import { createToolContext, type ToolRegistry } from "../../tools/registry.js";
import type { ToolDescriptor, ToolInvokeOptions } from "../../tools/types.js";

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

export function buildHelpDocument(registry: ToolRegistry): unknown {
	const tools = registry.describeAll();
	const toolNames = tools.map((tool) => tool.name);
	const groupedTools = buildHelpGroups(tools);

	return {
		service: "Figma Console Local API",
		version: "0.1.0",
		audience: "Agents and scripts exploring daemon-first Figma workflows over localhost HTTP.",
		discoveryFlow: [
			"Call GET /v1/status first when you need to know whether a Desktop Bridge connection is active.",
			"Call GET /v1/tools to browse the tool surface grouped by workflow area.",
			"Call GET /v1/tools/:name before invoking a tool so you can inspect schema, examples, transport support, and prerequisites.",
			"Call POST /v1/tools/:name with an input object only after you have narrowed the file, node, or component target.",
		],
		recommendations: {
			startingPoints: [
				"For runtime awareness, start with figma_get_status, figma_get_selection, or figma_list_open_files.",
				"For design-system discovery, start with figma_get_design_system_summary, figma_get_variables, or figma_search_components.",
				"For document inspection, start with figma_get_file_data before node-targeted writes.",
			],
			readVsWrite: [
				"Prefer read and analysis tools first to confirm identifiers, current state, and prerequisites.",
				"Use write tools only after confirming the target node, component, variable, or collection.",
			],
			prerequisites: [
				"Plugin-backed tools require the Desktop Bridge plugin to be open in the target Figma file.",
				"REST-backed tools require REST authentication, typically FIGMA_ACCESS_TOKEN in local mode.",
				"For cross-file library access, pass a file URL or library file key instead of relying on the active file.",
			],
			visualValidation: [
				"Use figma_capture_screenshot after writes when you need current plugin runtime state.",
				"Use figma_get_component_image when you need a stable REST-rendered reference image for an existing node.",
			],
			fallbacks: [
				"If a high-level tool is insufficient, use figma_execute as the lowest-level Plugin API escape hatch.",
			],
		},
		workflows: [
			{
				name: "Discover Then Edit",
				steps: [
					"Check daemon/runtime state.",
					"Find the target file, node, component, or variable with read tools.",
					"Inspect the specific tool schema.",
					"Invoke one write tool with focused input.",
					"Validate with screenshot, logs, or parity/lint tools.",
				],
			},
			{
				name: "Cross-File Library Access",
				steps: [
					"Use a REST-authenticated tool with a library file key or URL.",
					"Search or inspect the library component.",
					"Use a concrete component or variant key for instantiation.",
				],
			},
		],
		groupedTools,
		decisionHints: [
			{
				question: "Need current plugin state or active selection?",
				use: ["figma_get_status", "figma_get_selection", "figma_list_open_files"],
			},
			{
				question: "Need component, token, or library discovery?",
				use: ["figma_get_design_system_summary", "figma_search_components", "figma_get_component_details"],
			},
			{
				question: "Need visual or quality validation after a change?",
				use: ["figma_capture_screenshot", "figma_lint_design", "figma_check_design_parity"],
			},
		],
		invokeNotes: [
			"Unknown or missing fields will fail schema validation at invoke time.",
			"Most tools expect a compact input object rather than free-form text.",
			"Use examples from GET /v1/tools/:name as the canonical invocation shape.",
		],
		toolNames,
		examples: {
			status: {
				method: "GET",
				path: "/v1/status",
			},
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

function buildHelpGroups(tools: ToolDescriptor[]) {
	const grouped = new Map<string, string[]>();

	for (const tool of tools) {
		const names = grouped.get(tool.discoveryGroup) || [];
		names.push(tool.name);
		grouped.set(tool.discoveryGroup, names);
	}

	return Array.from(grouped.entries())
		.sort((a, b) => a[0].localeCompare(b[0]))
		.map(([group, names]) => ({
			group,
			toolCount: names.length,
			tools: names.sort(),
		}));
}
