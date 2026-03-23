#!/usr/bin/env node

import { createChildLogger } from "../core/logger.js";
import { LocalDaemonRuntime } from "./local-runtime.js";
import { clearHttpDiscovery, writeHttpDiscovery } from "./http-discovery.js";
import { ToolRegistry } from "../tools/registry.js";
import { createLocalReadToolDefinitions } from "../tools/catalog/local-read-tools.js";
import { runCli } from "../transports/cli/main.js";
import { startHttpServer } from "../transports/http/server.js";

const logger = createChildLogger({ component: "daemon-server" });

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const runtime = new LocalDaemonRuntime();
	const registry = new ToolRegistry();

	for (const definition of createLocalReadToolDefinitions()) {
		registry.register(definition);
	}

	if (args[0] === "daemon" && args[1] === "start") {
		await runtime.start();
		const preferredHttpPort = parseInt(process.env.FIGMA_HTTP_PORT || "3847", 10);
		const httpHost = process.env.FIGMA_HTTP_HOST || "127.0.0.1";
		const { server: httpServer, port: httpPort } = await startHttpServerWithFallback(
			preferredHttpPort,
			httpHost,
			runtime,
			registry,
		);

		const status = await runtime.getStatus();
		logger.info(
			{
				httpPort,
				wsPort: runtime.getWsPort(),
				activeFileUrl: status.activeFileUrl,
			},
			"Figma daemon started",
		);

		writeHttpDiscovery({
			pid: process.pid,
			host: httpHost,
			port: httpPort,
			baseUrl: `http://${httpHost}:${httpPort}`,
			startedAt: new Date().toISOString(),
		});

		let shuttingDown = false;
		const shutdown = async (signal: string) => {
			if (shuttingDown) {
				return;
			}
			shuttingDown = true;

			logger.info({ signal, httpPort, wsPort: runtime.getWsPort() }, "Shutting down Figma daemon");
			clearHttpDiscovery();

			await new Promise<void>((resolve, reject) => {
				httpServer.close((error?: Error) => {
					if (error) {
						reject(error);
						return;
					}
					resolve();
				});
			});
			await runtime.stop();
		};

		process.on("SIGINT", () => {
			void shutdown("SIGINT")
				.then(() => process.exit(0))
				.catch((error) => {
					const message = error instanceof Error ? error.message : String(error);
					logger.error({ error: message }, "Failed to shut down daemon after SIGINT");
					process.exit(1);
				});
		});

		process.on("SIGTERM", () => {
			void shutdown("SIGTERM")
				.then(() => process.exit(0))
				.catch((error) => {
					const message = error instanceof Error ? error.message : String(error);
					logger.error({ error: message }, "Failed to shut down daemon after SIGTERM");
					process.exit(1);
				});
		});

		process.stdin.resume();
		return;
	}

	const exitCode = await runCli(args, { registry, runtime });
	await runtime.stop();
	process.exit(exitCode);
}

void main().catch((error) => {
	const message = error instanceof Error ? error.message : String(error);
	clearHttpDiscovery();
	logger.error({ error: message }, "Daemon server failed");
	process.exit(1);
});

async function startHttpServerWithFallback(
	preferredPort: number,
	host: string,
	runtime: LocalDaemonRuntime,
	registry: ToolRegistry,
): Promise<{ server: Awaited<ReturnType<typeof startHttpServer>>["server"]; port: number }> {
	for (let port = preferredPort; port < preferredPort + 10; port++) {
		try {
			const started = await startHttpServer({
				port,
				host,
				runtime,
				registry,
			});
			return started;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			const code = error instanceof Error ? (error as Error & { code?: string }).code : undefined;
			if (code === "EADDRINUSE" || message.includes("EADDRINUSE")) {
				continue;
			}
			throw error;
		}
	}

	throw new Error(`Could not bind HTTP server in port range starting at ${preferredPort}`);
}
