import { createChildLogger } from "../core/logger.js";
import { FigmaAPI, extractFigmaUrlInfo } from "../core/figma-api.js";
import type { ConsoleMonitor } from "../core/console-monitor.js";
import type { IFigmaConnector } from "../core/figma-connector.js";
import { DEFAULT_WS_PORT, HEARTBEAT_INTERVAL_MS, advertisePort, cleanupOrphanedProcesses, cleanupStalePortFiles, getPortRange, refreshPortAdvertisement, registerPortCleanup, unadvertisePort } from "../core/port-discovery.js";
import { FigmaWebSocketServer } from "../core/websocket-server.js";
import { WebSocketConnector } from "../core/websocket-connector.js";
import type {
	FigmaRuntime,
	RuntimeConnectedFile,
	RuntimeConsoleStatus,
	RuntimeDocumentChange,
	RuntimeSelection,
	RuntimeStatus,
} from "./runtime.js";

const logger = createChildLogger({ component: "daemon-runtime" });

export interface LocalDaemonRuntimeOptions {
	wsHost?: string;
	wsPort?: number;
}

export class LocalDaemonRuntime implements FigmaRuntime {
	private readonly options: LocalDaemonRuntimeOptions;
	private readonly variablesCache = new Map<string, { data: unknown; timestamp: number }>();
	private wsServer: FigmaWebSocketServer | null = null;
	private connector: IFigmaConnector | null = null;
	private figmaAPI: FigmaAPI | null = null;
	private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
	private actualWsPort: number | null = null;

	constructor(options: LocalDaemonRuntimeOptions = {}) {
		this.options = options;
	}

	async start(): Promise<void> {
		if (this.wsServer?.isStarted()) {
			return;
		}

		const wsHost = this.options.wsHost || process.env.FIGMA_WS_HOST || "localhost";
		const preferredPort = this.options.wsPort || parseInt(process.env.FIGMA_WS_PORT || String(DEFAULT_WS_PORT), 10);

		cleanupStalePortFiles();
		cleanupOrphanedProcesses(preferredPort);

		for (const port of getPortRange(preferredPort)) {
			try {
				const wsServer = new FigmaWebSocketServer({ port, host: wsHost });
				await wsServer.start();
				const addr = wsServer.address();
				const boundPort = addr?.port ?? port;

				this.wsServer = wsServer;
				this.actualWsPort = boundPort;

				advertisePort(boundPort, wsHost);
				registerPortCleanup(boundPort);

				this.heartbeatTimer = setInterval(() => refreshPortAdvertisement(boundPort), HEARTBEAT_INTERVAL_MS);
				this.heartbeatTimer.unref();

				wsServer.on("documentChange", (data: { fileKey?: string }) => {
					if (data.fileKey) {
						this.variablesCache.delete(data.fileKey);
						return;
					}
					this.variablesCache.clear();
				});

				logger.info({ wsHost, preferredPort, boundPort }, "Local daemon runtime started");
				return;
			} catch (error) {
				const errorCode = error instanceof Error ? (error as Error & { code?: string }).code : undefined;
				const errorMessage = error instanceof Error ? error.message : String(error);
				if (errorCode === "EADDRINUSE" || errorMessage.includes("EADDRINUSE")) {
					continue;
				}
				throw error;
			}
		}

		throw new Error(`Could not bind Desktop Bridge WebSocket server in port range starting at ${preferredPort}`);
	}

	async stop(): Promise<void> {
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer);
			this.heartbeatTimer = null;
		}

		if (this.actualWsPort) {
			unadvertisePort(this.actualWsPort);
			this.actualWsPort = null;
		}

		if (this.wsServer) {
			await this.wsServer.stop();
			this.wsServer = null;
		}

		this.connector = null;
	}

	async getStatus(): Promise<RuntimeStatus> {
		const fileInfo = this.wsServer?.getConnectedFileInfo() || null;
		const selection = this.wsServer?.getCurrentSelection() || null;
		const restToken = process.env.FIGMA_ACCESS_TOKEN;

		return {
			connected: !!this.wsServer?.isClientConnected(),
			mode: "local",
			activeFileUrl: this.getCurrentFileUrl(),
			pluginConnected: !!this.wsServer?.isClientConnected(),
			restAuthenticated: !!restToken,
			selectionCount: selection?.count,
			warnings: fileInfo ? [] : ["No active Figma file connected via Desktop Bridge plugin."],
		};
	}

	async getDesktopConnector(): Promise<IFigmaConnector> {
		await this.start();

		if (!this.wsServer) {
			throw new Error("Desktop Bridge WebSocket server is not available.");
		}

		if (!this.connector) {
			const connector = new WebSocketConnector(this.wsServer);
			await connector.initialize();
			this.connector = connector;
		}

		return this.connector;
	}

	async getFigmaAPI(): Promise<FigmaAPI> {
		if (!this.figmaAPI) {
			const accessToken = process.env.FIGMA_ACCESS_TOKEN;
			if (!accessToken) {
				throw new Error(
					"FIGMA_ACCESS_TOKEN not configured. Set it in the environment for REST-backed operations.",
				);
			}
			this.figmaAPI = new FigmaAPI({ accessToken });
		}
		return this.figmaAPI;
	}

	getCurrentFileUrl(): string | null {
		const fileInfo = this.wsServer?.getConnectedFileInfo();
		if (!fileInfo?.fileKey) {
			return null;
		}

		const pageId = fileInfo.currentPageId ? `?page-id=${encodeURIComponent(fileInfo.currentPageId)}` : "";
		return `https://www.figma.com/design/${fileInfo.fileKey}/${encodeURIComponent(fileInfo.fileName || "Untitled")}${pageId}`;
	}

	getVariablesCache(): Map<string, { data: unknown; timestamp: number }> {
		return this.variablesCache;
	}

	getConsoleMonitor(): ConsoleMonitor | null {
		return null;
	}

	getCurrentSelection(): RuntimeSelection | null {
		const selection = this.wsServer?.getCurrentSelection() || null;
		if (!selection) {
			return null;
		}

		return {
			nodes: selection.nodes.map((node) => ({
				id: node.id,
				name: node.name,
				type: node.type,
				width: node.width,
				height: node.height,
			})),
			count: selection.count,
			page: selection.page,
			timestamp: selection.timestamp,
		};
	}

	getConnectedFiles(): RuntimeConnectedFile[] {
		return (this.wsServer?.getConnectedFiles() || []).map((file) => ({
			fileName: file.fileName,
			fileKey: file.fileKey,
			currentPage: file.currentPage,
			currentPageId: file.currentPageId,
			connectedAt: file.connectedAt,
			isActive: file.isActive,
		}));
	}

	getDocumentChanges(options?: { count?: number; since?: number }): RuntimeDocumentChange[] {
		return (this.wsServer?.getDocumentChanges(options) || []).map((entry) => ({
			hasStyleChanges: entry.hasStyleChanges,
			hasNodeChanges: entry.hasNodeChanges,
			changedNodeIds: [...entry.changedNodeIds],
			changeCount: entry.changeCount,
			timestamp: entry.timestamp,
		}));
	}

	clearDocumentChanges(): number {
		return this.wsServer?.clearDocumentChanges() || 0;
	}

	getConsoleLogs(options?: { count?: number; level?: "log" | "info" | "warn" | "error" | "debug" | "all"; since?: number }) {
		return [...(this.wsServer?.getConsoleLogs(options) || [])];
	}

	clearConsoleLogs(): number {
		return this.wsServer?.clearConsoleLogs() || 0;
	}

	getConsoleStatus(): RuntimeConsoleStatus | null {
		const status = this.wsServer?.getConsoleStatus();
		if (!status) {
			return null;
		}

		return {
			isMonitoring: status.isMonitoring,
			anyClientConnected: status.anyClientConnected,
			logCount: status.logCount,
			bufferSize: status.bufferSize,
			workerCount: status.workerCount,
			oldestTimestamp: status.oldestTimestamp,
			newestTimestamp: status.newestTimestamp,
		};
	}

	async reconnect(): Promise<RuntimeStatus> {
		this.connector = null;
		await this.start();
		await this.getDesktopConnector();
		return this.getStatus();
	}

	async reloadPluginUi(options?: { clearConsole?: boolean }): Promise<{
		status: "reloaded";
		transport: "websocket";
		consoleCleared: boolean;
		clearedCount: number;
		timestamp: number;
	}> {
		await this.start();
		if (!this.wsServer?.isClientConnected()) {
			throw new Error("No WebSocket client connected. Make sure the Desktop Bridge plugin is open in Figma.");
		}

		const clearConsole = options?.clearConsole ?? true;
		const clearedCount = clearConsole ? this.wsServer.clearConsoleLogs() : 0;
		await this.wsServer.sendCommand("RELOAD_UI", {}, 10000);
		await new Promise((resolve) => setTimeout(resolve, 3000));

		this.connector = null;

		return {
			status: "reloaded",
			transport: "websocket",
			consoleCleared: clearConsole,
			clearedCount,
			timestamp: Date.now(),
		};
	}

	getWsPort(): number | null {
		return this.actualWsPort;
	}

	getActiveFileKey(): string | null {
		const url = this.getCurrentFileUrl();
		if (!url) return null;
		const info = extractFigmaUrlInfo(url);
		return info?.branchId || info?.fileKey || null;
	}

	async ensureInitialized(): Promise<void> {
		await this.start();
	}
}
