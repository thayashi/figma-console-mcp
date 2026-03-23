import type { FigmaAPI } from "../core/figma-api.js";
import type { ConsoleMonitor } from "../core/console-monitor.js";
import type { IFigmaConnector } from "../core/figma-connector.js";
import type { ConsoleLogEntry } from "../core/types/index.js";
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

export interface RuntimeSelectionNode {
	id: string;
	name: string;
	type: string;
	width?: number;
	height?: number;
}

export interface RuntimeSelection {
	nodes: RuntimeSelectionNode[];
	count: number;
	page: string;
	timestamp: number;
}

export interface RuntimeConnectedFile {
	fileName: string;
	fileKey: string | null;
	currentPage?: string;
	currentPageId?: string;
	connectedAt: number;
	isActive: boolean;
}

export interface RuntimeDocumentChange {
	hasStyleChanges: boolean;
	hasNodeChanges: boolean;
	changedNodeIds: string[];
	changeCount: number;
	timestamp: number;
}

export interface RuntimeConsoleStatus {
	isMonitoring: boolean;
	anyClientConnected: boolean;
	logCount: number;
	bufferSize: number;
	workerCount: number;
	oldestTimestamp?: number;
	newestTimestamp?: number;
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
	getCurrentSelection?(): RuntimeSelection | null;
	getConnectedFiles?(): RuntimeConnectedFile[];
	getDocumentChanges?(options?: { count?: number; since?: number }): RuntimeDocumentChange[];
	clearDocumentChanges?(): number;
	getConsoleLogs?(options?: { count?: number; level?: ConsoleLogEntry["level"] | "all"; since?: number }): ConsoleLogEntry[];
	clearConsoleLogs?(): number;
	getConsoleStatus?(): RuntimeConsoleStatus | null;
	reconnect?(): Promise<RuntimeStatus>;
	reloadPluginUi?(options?: { clearConsole?: boolean }): Promise<{
		status: "reloaded";
		transport: "websocket";
		consoleCleared: boolean;
		clearedCount: number;
		timestamp: number;
	}>;
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
