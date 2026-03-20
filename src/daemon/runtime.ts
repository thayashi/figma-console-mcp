import type { FigmaAPI } from "../core/figma-api.js";
import type { ConsoleMonitor } from "../core/console-monitor.js";
import type { IFigmaConnector } from "../core/figma-connector.js";
import type { ToolTransport } from "../tools/types.js";

export interface RuntimeStatus {
	connected: boolean;
	mode: "local";
	activeFileUrl: string | null;
	pluginConnected: boolean;
	restAuthenticated: boolean;
	selectionCount?: number;
	warnings?: string[];
}

export interface ToolRequestContext {
	requestId: string;
	transport: ToolTransport;
	interactive: boolean;
}

export interface FigmaRuntime {
	getStatus(): Promise<RuntimeStatus>;
	getDesktopConnector(): Promise<IFigmaConnector>;
	getFigmaAPI(): Promise<FigmaAPI>;
	getCurrentFileUrl(): string | null;
	getVariablesCache(): Map<string, { data: unknown; timestamp: number }>;
	getConsoleMonitor(): ConsoleMonitor | null;
	ensureInitialized?(): Promise<void>;
}

export interface ToolContext {
	runtime: FigmaRuntime;
	request: ToolRequestContext;
}

export class RuntimeUnavailableError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "RuntimeUnavailableError";
	}
}
