import { readFileSync } from "node:fs";
import type { FigmaRuntime } from "../../daemon/runtime.js";
import type { ToolRegistry } from "../../tools/registry.js";
import { formatCliUsage, formatToolDetails, formatToolList } from "./help.js";
import { fetchDaemonStatus, fetchToolDetails, fetchToolList, invokeToolViaDaemon } from "./http-client.js";

export interface CliDependencies {
	registry: ToolRegistry;
	runtime: FigmaRuntime;
	stdout?: NodeJS.WritableStream;
	stderr?: NodeJS.WritableStream;
}

export async function runCli(
	args: string[],
	deps: CliDependencies,
): Promise<number> {
	const stdout = deps.stdout || process.stdout;
	const stderr = deps.stderr || process.stderr;
	const [command, subcommand, maybeTool, ...rest] = args;

	if (!command) {
		stdout.write(`${formatCliUsage()}\n`);
		return 0;
	}

	if (command === "tools" && subcommand === "list") {
		const tools = await fetchToolList();
		if (!tools) {
			stderr.write("No running daemon found. Start it with `figma-console daemon start`.\n");
			return 1;
		}
		stdout.write(`${formatToolList(tools)}\n`);
		return 0;
	}

	if (command === "tools" && subcommand === "show") {
		if (!maybeTool) {
			stderr.write("Missing tool name.\n");
			return 1;
		}

		const tool = await fetchToolDetails(maybeTool);
		if (tool === "NOT_FOUND") {
			stderr.write(`Unknown tool: ${maybeTool}\n`);
			return 1;
		}
		if (!tool) {
			stderr.write("No running daemon found. Start it with `figma-console daemon start`.\n");
			return 1;
		}

		stdout.write(`${formatToolDetails(tool)}\n`);
		return 0;
	}

	if (command === "daemon" && subcommand === "status") {
		const status = await fetchDaemonStatus();
		if (!status) {
			stderr.write("No running daemon found. Start it with `figma-console daemon start`.\n");
			return 1;
		}
		stdout.write(`${JSON.stringify(status, null, 2)}\n`);
		return 0;
	}

	if (command === "invoke") {
		const toolName = subcommand;
		if (!toolName) {
			stderr.write("Missing tool name.\n");
			return 1;
		}

		let input: unknown;
		try {
			input = parseInputArg(maybeTool, rest);
		} catch (error) {
			stderr.write(`${formatInputError(error)}\n`);
			return 1;
		}

		const daemonResult = await invokeToolViaDaemon(toolName, input);
		if (!daemonResult) {
			stderr.write("No running daemon found. Start it with `figma-console daemon start`.\n");
			return 1;
		}
		if (daemonResult === "NOT_FOUND") {
			stderr.write(`Unknown tool: ${toolName}\n`);
			return 1;
		}
		if ("kind" in daemonResult && daemonResult.kind === "HTTP_ERROR") {
			stderr.write(`${JSON.stringify(formatHttpError(toolName, daemonResult.status, daemonResult.body), null, 2)}\n`);
			return 1;
		}
		if (!("ok" in daemonResult)) {
			stderr.write(`${JSON.stringify(formatHttpError(toolName, 500, daemonResult), null, 2)}\n`);
			return 1;
		}
		const stream = daemonResult.ok ? stdout : stderr;
		stream.write(`${JSON.stringify(daemonResult, null, 2)}\n`);
		return daemonResult.ok ? 0 : 1;
	}

	stderr.write(`${formatCliUsage()}\n`);
	return 1;
}

function parseInputArg(firstArg?: string, rest: string[] = []): unknown {
	const inputFlagIndex = [firstArg, ...rest].findIndex((arg) => arg === "--input");
	if (inputFlagIndex === -1) {
		return {};
	}

	const args = [firstArg, ...rest];
	const rawValue = args[inputFlagIndex + 1];
	if (!rawValue) {
		throw new CliInputError(
			"Missing value for --input.",
			"Pass inline JSON or @path/to/payload.json after --input.",
		);
	}

	if (rawValue.startsWith("@")) {
		const filePath = rawValue.slice(1);
		try {
			return JSON.parse(readFileSync(filePath, "utf8"));
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new CliInputError(
				`Failed to read input file: ${filePath}.`,
				`Check that the file exists and contains valid JSON. Original error: ${message}`,
			);
		}
	}

	try {
		return JSON.parse(rawValue);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new CliInputError(
			"Invalid JSON passed to --input.",
			`Pass a valid JSON object string. Original error: ${message}`,
		);
	}
}

class CliInputError extends Error {
	constructor(
		message: string,
		readonly hint: string,
	) {
		super(message);
		this.name = "CliInputError";
	}
}

function formatInputError(error: unknown): string {
	if (error instanceof CliInputError) {
		return JSON.stringify(
			{
				ok: false,
				error: {
					code: "CLI_INPUT_ERROR",
					message: error.message,
					hint: error.hint,
				},
			},
			null,
			2,
		);
	}

	return JSON.stringify(
		{
			ok: false,
			error: {
				code: "CLI_INPUT_ERROR",
				message: error instanceof Error ? error.message : String(error),
			},
		},
		null,
		2,
	);
}

function formatHttpError(toolName: string, status: number, body: unknown) {
	const bodyObject = typeof body === "object" && body !== null ? (body as Record<string, any>) : null;
	const nestedError = bodyObject?.error && typeof bodyObject.error === "object" ? bodyObject.error as Record<string, any> : null;
	const nestedMessage = typeof nestedError?.message === "string" ? nestedError.message : undefined;
	const nestedCode = typeof nestedError?.code === "string" ? nestedError.code : undefined;
	const nestedHint = typeof nestedError?.hint === "string" ? nestedError.hint : undefined;

	return {
		ok: false,
		tool: toolName,
		error: {
			code: nestedCode || "CLI_HTTP_ERROR",
			message: nestedMessage || `Daemon returned HTTP ${status} while invoking ${toolName}.`,
			hint: nestedHint || inferHttpHint(status, nestedCode),
		},
		http: {
			status,
		},
	};
}

function inferHttpHint(status: number, code?: string): string | undefined {
	if (code === "TOOL_NOT_FOUND" || status === 404) {
		return "Call `figma-console tools list` to discover available tools.";
	}
	if (status === 400) {
		return "Inspect the tool schema with `figma-console tools show <tool>` and retry with a valid input object.";
	}
	if (status >= 500) {
		return "Check daemon logs or retry after confirming the daemon is healthy.";
	}
	return undefined;
}
