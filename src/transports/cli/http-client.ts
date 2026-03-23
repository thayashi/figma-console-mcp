import type { ToolDescriptor, ToolExecutionResult } from "../../tools/types.js";
import { readHttpDiscovery } from "../../daemon/http-discovery.js";

export interface CliHttpTarget {
	host: string;
	port: number;
	baseUrl: string;
}

export type FetchToolDetailsResult = ToolDescriptor | "NOT_FOUND" | null;
export type InvokeToolViaDaemonResult =
	| ToolExecutionResult
	| "NOT_FOUND"
	| {
			kind: "HTTP_ERROR";
			status: number;
			body: unknown;
	  }
	| null;

export function getCliHttpTargets(): CliHttpTarget[] {
	const host = process.env.FIGMA_HTTP_HOST || "127.0.0.1";
	const preferredPort = parseInt(process.env.FIGMA_HTTP_PORT || "3847", 10);
	const targets: CliHttpTarget[] = [];
	const advertised = readHttpDiscovery();

	if (advertised) {
		targets.push({
			host: advertised.host,
			port: advertised.port,
			baseUrl: advertised.baseUrl,
		});
	}

	for (let port = preferredPort; port < preferredPort + 10; port++) {
		if (advertised && port === advertised.port && host === advertised.host) {
			continue;
		}
		targets.push({
			host,
			port,
			baseUrl: `http://${host}:${port}`,
		});
	}

	return targets;
}

export async function fetchDaemonStatus(): Promise<unknown | null> {
	for (const target of getCliHttpTargets()) {
		try {
			const response = await fetch(`${target.baseUrl}/v1/status`);
			if (!response.ok) continue;
			return await response.json();
		} catch {
			continue;
		}
	}

	return null;
}

export async function fetchToolList(): Promise<ToolDescriptor[] | null> {
	for (const target of getCliHttpTargets()) {
		try {
			const response = await fetch(`${target.baseUrl}/v1/tools`);
			if (!response.ok) continue;
			const data = (await response.json()) as { tools?: ToolDescriptor[] };
			return data.tools || [];
		} catch {
			continue;
		}
	}

	return null;
}

export async function fetchToolDetails(toolName: string): Promise<FetchToolDetailsResult> {
	for (const target of getCliHttpTargets()) {
		try {
			const response = await fetch(`${target.baseUrl}/v1/tools/${encodeURIComponent(toolName)}`);
			if (response.status === 404) return "NOT_FOUND";
			if (!response.ok) continue;
			return (await response.json()) as ToolDescriptor;
		} catch {
			continue;
		}
	}

	return null;
}

export async function invokeToolViaDaemon(
	toolName: string,
	input: unknown,
): Promise<InvokeToolViaDaemonResult> {
	for (const target of getCliHttpTargets()) {
		try {
			const response = await fetch(`${target.baseUrl}/v1/tools/${encodeURIComponent(toolName)}`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ input }),
			});
			const data = await response.json();
			if (response.status === 404) {
				return "NOT_FOUND";
			}
			if (!response.ok) {
				return {
					kind: "HTTP_ERROR",
					status: response.status,
					body: data,
				};
			}
			return data as ToolExecutionResult;
		} catch {
			continue;
		}
	}

	return null;
}
