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
		const { port: httpPort } = await startHttpServerWithFallback(
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
): Promise<{ port: number }> {
	for (let port = preferredPort; port < preferredPort + 10; port++) {
		try {
			const started = await startHttpServer({
				port,
				host,
				runtime,
				registry,
			});
			return { port: started.port };
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
