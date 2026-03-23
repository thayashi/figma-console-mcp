jest.mock("../src/transports/cli/http-client", () => ({
	fetchDaemonStatus: jest.fn(),
	fetchToolDetails: jest.fn(),
	fetchToolList: jest.fn(),
	invokeToolViaDaemon: jest.fn(),
}));

import { runCli } from "../src/transports/cli/main";
import {
	fetchToolDetails,
	invokeToolViaDaemon,
} from "../src/transports/cli/http-client";

function createStream() {
	let output = "";
	return {
		stream: {
			write: (chunk: string) => {
				output += chunk;
				return true;
			},
		},
		read: () => output,
	};
}

describe("CLI main error handling", () => {
	beforeEach(() => {
		jest.resetAllMocks();
	});

	it("reports invalid inline JSON input as a CLI input error", async () => {
		const stdout = createStream();
		const stderr = createStream();

		const exitCode = await runCli(
			["invoke", "figma_get_status", "--input", "{not-json}"],
			{
				registry: {} as any,
				runtime: {} as any,
				stdout: stdout.stream as any,
				stderr: stderr.stream as any,
			},
		);

		expect(exitCode).toBe(1);
		expect(stderr.read()).toContain('"code": "CLI_INPUT_ERROR"');
		expect(stderr.read()).toContain("Invalid JSON passed to --input.");
	});

	it("reports unknown invoke tool without pretending the daemon is offline", async () => {
		const stdout = createStream();
		const stderr = createStream();
		(invokeToolViaDaemon as jest.Mock).mockResolvedValue("NOT_FOUND");

		const exitCode = await runCli(
			["invoke", "figma_missing_tool"],
			{
				registry: {} as any,
				runtime: {} as any,
				stdout: stdout.stream as any,
				stderr: stderr.stream as any,
			},
		);

		expect(exitCode).toBe(1);
		expect(stderr.read()).toContain("Unknown tool: figma_missing_tool");
	});

	it("formats daemon HTTP 400 responses as actionable CLI JSON errors", async () => {
		const stdout = createStream();
		const stderr = createStream();
		(invokeToolViaDaemon as jest.Mock).mockResolvedValue({
			kind: "HTTP_ERROR",
			status: 400,
			body: {
				ok: false,
				error: {
					code: "TOOL_EXECUTION_FAILED",
					message: "Required",
				},
			},
		});

		const exitCode = await runCli(
			["invoke", "figma_get_file_data"],
			{
				registry: {} as any,
				runtime: {} as any,
				stdout: stdout.stream as any,
				stderr: stderr.stream as any,
			},
		);

		expect(exitCode).toBe(1);
		expect(stderr.read()).toContain('"code": "TOOL_EXECUTION_FAILED"');
		expect(stderr.read()).toContain('"status": 400');
		expect(stderr.read()).toContain("Inspect the tool schema");
	});

	it("reports unknown tools for tools show separately from daemon absence", async () => {
		const stdout = createStream();
		const stderr = createStream();
		(fetchToolDetails as jest.Mock).mockResolvedValue("NOT_FOUND");

		const exitCode = await runCli(
			["tools", "show", "figma_missing_tool"],
			{
				registry: {} as any,
				runtime: {} as any,
				stdout: stdout.stream as any,
				stderr: stderr.stream as any,
			},
		);

		expect(exitCode).toBe(1);
		expect(stderr.read()).toContain("Unknown tool: figma_missing_tool");
	});
});
