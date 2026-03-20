import { z } from "zod";
import type { ToolContext } from "../daemon/runtime.js";

export type ToolTransport = "cli" | "http" | "mcp";

export type ToolResponseShape = "small" | "medium" | "large";

export type ToolSideEffects = "none" | "document_write" | "network_read";

export interface ToolExample {
	title: string;
	input: unknown;
	notes?: string;
}

export interface ToolCommonError {
	code: string;
	message: string;
	hint?: string;
}

export interface ToolCapabilities {
	requiresPlugin?: boolean;
	requiresRestToken?: boolean;
	supportsHttp?: boolean;
	supportsCli?: boolean;
	supportsMcp?: boolean;
	responseShape?: ToolResponseShape;
	sideEffects?: ToolSideEffects;
}

export interface ToolInvokeOptions {
	verbosity?: string;
	format?: string;
	pageSize?: number;
}

export interface ToolExecutionMeta {
	requestId: string;
	transport: ToolTransport;
	durationMs: number;
	warnings: string[];
}

export interface ToolExecutionSuccess<TOutput = unknown> {
	ok: true;
	tool: string;
	data: TOutput;
	meta: ToolExecutionMeta;
}

export interface ToolExecutionFailure {
	ok: false;
	tool: string;
	error: {
		code: string;
		message: string;
		hint?: string;
	};
	meta: ToolExecutionMeta;
}

export type ToolExecutionResult<TOutput = unknown> =
	| ToolExecutionSuccess<TOutput>
	| ToolExecutionFailure;

export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
	name: string;
	summary: string;
	description: string;
	tags: string[];
	discoveryGroup: string;
	inputSchema: z.ZodTypeAny;
	outputSchema?: z.ZodTypeAny;
	capabilities: ToolCapabilities;
	examples?: ToolExample[];
	relatedTools?: string[];
	commonErrors?: ToolCommonError[];
	handler: (
		ctx: ToolContext,
		input: TInput,
		options?: ToolInvokeOptions,
	) => Promise<TOutput>;
}

export interface ToolDescriptor {
	name: string;
	summary: string;
	description: string;
	tags: string[];
	discoveryGroup: string;
	capabilities: ToolCapabilities;
	examples: ToolExample[];
	relatedTools: string[];
	commonErrors: ToolCommonError[];
	inputSchema: unknown;
	outputSchema?: unknown;
}
