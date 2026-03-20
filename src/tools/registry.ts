import { zodToJsonSchema } from "zod-to-json-schema";
import type { FigmaRuntime, ToolContext } from "../daemon/runtime.js";
import type {
	ToolDefinition,
	ToolDescriptor,
	ToolExecutionFailure,
	ToolExecutionResult,
	ToolInvokeOptions,
	ToolTransport,
} from "./types.js";

export class ToolRegistry {
	private readonly definitions = new Map<string, ToolDefinition<any, any>>();

	register<TInput, TOutput>(definition: ToolDefinition<TInput, TOutput>): void {
		if (this.definitions.has(definition.name)) {
			throw new Error(`Tool already registered: ${definition.name}`);
		}
		this.definitions.set(definition.name, definition);
	}

	get(name: string): ToolDefinition<any, any> | undefined {
		return this.definitions.get(name);
	}

	list(): ToolDefinition<any, any>[] {
		return Array.from(this.definitions.values()).sort((a, b) =>
			a.name.localeCompare(b.name),
		);
	}

	describe(name: string): ToolDescriptor | undefined {
		const definition = this.get(name);
		if (!definition) {
			return undefined;
		}

		return serializeToolDefinition(definition);
	}

	describeAll(): ToolDescriptor[] {
		return this.list().map(serializeToolDefinition);
	}

	async invoke(
		name: string,
		ctx: ToolContext,
		input: unknown,
		options?: ToolInvokeOptions,
	): Promise<ToolExecutionResult> {
		const definition = this.get(name);
		const start = Date.now();

		if (!definition) {
			return {
				ok: false,
				tool: name,
				error: {
					code: "TOOL_NOT_FOUND",
					message: `Unknown tool: ${name}`,
					hint: "Call tools list to discover available tools.",
				},
				meta: {
					requestId: ctx.request.requestId,
					transport: ctx.request.transport,
					durationMs: Date.now() - start,
					warnings: [],
				},
			};
		}

		try {
			const parsedInput = definition.inputSchema.parse(input);
			const data = await definition.handler(ctx, parsedInput, options);

			return {
				ok: true,
				tool: name,
				data,
				meta: {
					requestId: ctx.request.requestId,
					transport: ctx.request.transport,
					durationMs: Date.now() - start,
					warnings: [],
				},
			};
		} catch (error) {
			return toFailureResult(
				name,
				ctx.request.requestId,
				ctx.request.transport,
				start,
				error,
			);
		}
	}
}

export function createToolContext(
	runtime: FigmaRuntime,
	transport: ToolTransport,
	requestId: string,
	interactive: boolean,
): ToolContext {
	return {
		runtime,
		request: {
			requestId,
			transport,
			interactive,
		},
	};
}

export function serializeToolDefinition(
	definition: ToolDefinition<any, any>,
): ToolDescriptor {
	return {
		name: definition.name,
		summary: definition.summary,
		description: definition.description,
		tags: definition.tags,
		discoveryGroup: definition.discoveryGroup,
		capabilities: definition.capabilities,
		examples: definition.examples || [],
		relatedTools: definition.relatedTools || [],
		commonErrors: definition.commonErrors || [],
		inputSchema: zodToJsonSchema(definition.inputSchema, {
			name: `${definition.name}Input`,
		}),
		outputSchema: definition.outputSchema
			? zodToJsonSchema(definition.outputSchema, {
					name: `${definition.name}Output`,
				})
			: undefined,
	};
}

function toFailureResult(
	tool: string,
	requestId: string,
	transport: ToolTransport,
	start: number,
	error: unknown,
): ToolExecutionFailure {
	const message = error instanceof Error ? error.message : String(error);

	return {
		ok: false,
		tool,
		error: {
			code: "TOOL_EXECUTION_FAILED",
			message,
		},
		meta: {
			requestId,
			transport,
			durationMs: Date.now() - start,
			warnings: [],
		},
	};
}
