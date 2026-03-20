import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DISCOVERY_DIR = join(homedir(), ".figma-console-mcp");
const DISCOVERY_FILE = join(DISCOVERY_DIR, "daemon-http.json");

export interface HttpDiscoveryRecord {
	pid: number;
	host: string;
	port: number;
	baseUrl: string;
	startedAt: string;
}

export function writeHttpDiscovery(record: HttpDiscoveryRecord): void {
	mkdirSync(DISCOVERY_DIR, { recursive: true });
	writeFileSync(DISCOVERY_FILE, JSON.stringify(record, null, 2), "utf8");
}

export function readHttpDiscovery(): HttpDiscoveryRecord | null {
	if (!existsSync(DISCOVERY_FILE)) {
		return null;
	}

	try {
		const record = JSON.parse(readFileSync(DISCOVERY_FILE, "utf8")) as HttpDiscoveryRecord;
		process.kill(record.pid, 0);
		return record;
	} catch {
		try {
			unlinkSync(DISCOVERY_FILE);
		} catch {
			// ignore cleanup errors
		}
		return null;
	}
}

export function clearHttpDiscovery(): void {
	if (!existsSync(DISCOVERY_FILE)) {
		return;
	}

	try {
		unlinkSync(DISCOVERY_FILE);
	} catch {
		// ignore cleanup errors
	}
}
