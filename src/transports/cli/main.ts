import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import type { FigmaRuntime } from "../../daemon/runtime.js";
import { createToolContext, type ToolRegistry } from "../../tools/registry.js";
import { formatCliUsage, formatToolDetails, formatToolList } from "./help.js";
import { fetchDaemonStatus, fetchToolDetails, invokeToolViaDaemon } from "./http-client.js";

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
		stdout.write(`${formatToolList(deps.registry.describeAll())}\n`);
		return 0;
	}

	if (command === "tools" && subcommand === "show") {
		if (!maybeTool) {
			stderr.write("Missing tool name.\n");
			return 1;
		}

		const tool = (await fetchToolDetails(maybeTool)) || deps.registry.describe(maybeTool);
		if (!tool) {
			stderr.write(`Unknown tool: ${maybeTool}\n`);
			return 1;
		}

		stdout.write(`${formatToolDetails(tool)}\n`);
		return 0;
	}

	if (command === "daemon" && subcommand === "status") {
		const status = (await fetchDaemonStatus()) || (await deps.runtime.getStatus());
		stdout.write(`${JSON.stringify(status, null, 2)}\n`);
		return 0;
	}

	if (command === "invoke") {
		const toolName = subcommand;
		if (!toolName) {
			stderr.write("Missing tool name.\n");
			return 1;
		}

		const input = parseInputArg(maybeTool, rest);
		const daemonResult = await invokeToolViaDaemon(toolName, input);
		if (daemonResult) {
			const stream = daemonResult.ok ? stdout : stderr;
			stream.write(`${JSON.stringify(daemonResult, null, 2)}\n`);
			return daemonResult.ok ? 0 : 1;
		}

		const ctx = createToolContext(deps.runtime, "cli", randomUUID(), true);
		const result = await deps.registry.invoke(toolName, ctx, input);
		const stream = result.ok ? stdout : stderr;
		stream.write(`${JSON.stringify(result, null, 2)}\n`);
		return result.ok ? 0 : 1;
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
		return {};
	}

	if (rawValue.startsWith("@")) {
		const filePath = rawValue.slice(1);
		return JSON.parse(readFileSync(filePath, "utf8"));
	}

	return JSON.parse(rawValue);
}
