import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	loadProjectPolicy,
	summarizeProjectPolicyState,
} from "../src/daemon/project-policy";

describe("project policy loader", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "figma-policy-"));
	});

	afterEach(() => {
		if (tempDir) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("loads figma-console.project.json from the nearest parent directory", () => {
		const workspaceRoot = join(tempDir, "workspace");
		const nestedDir = join(workspaceRoot, "apps", "web");
		mkdirSync(nestedDir, { recursive: true });

		writeFileSync(
			join(workspaceRoot, "figma-console.project.json"),
			JSON.stringify({
				version: 1,
				projectName: "Acme Dashboard",
				mockups: {
					preferredFonts: ["Inter"],
					preferredComponents: {
						buttons: ["Button/Primary"],
					},
				},
			}),
			"utf8",
		);

		const state = loadProjectPolicy({ cwd: nestedDir, env: {} });

		expect(state.status).toBe("loaded");
		expect(state.policy?.workspaceRoot).toBe(workspaceRoot);
		expect(state.policy?.policy.projectName).toBe("Acme Dashboard");
		expect(state.checkedPaths[0]).toBe(join(nestedDir, "figma-console.project.json"));
	});

	it("prefers FIGMA_PROJECT_POLICY_PATH when set", () => {
		const workspaceRoot = join(tempDir, "workspace");
		const nestedDir = join(workspaceRoot, "apps", "web");
		mkdirSync(nestedDir, { recursive: true });

		const policyPath = join(tempDir, "custom-policy.json");
		writeFileSync(
			policyPath,
			JSON.stringify({
				version: 1,
				projectName: "Override Policy",
				mockups: {
					preferredFonts: ["IBM Plex Sans"],
				},
			}),
			"utf8",
		);

		const state = loadProjectPolicy({
			cwd: nestedDir,
			env: {
				FIGMA_PROJECT_POLICY_PATH: policyPath,
			},
		});

		expect(state.status).toBe("loaded");
		expect(state.checkedPaths).toEqual([policyPath]);
		expect(state.policy?.policy.projectName).toBe("Override Policy");
	});

	it("returns an error state for invalid policy JSON", () => {
		const workspaceRoot = join(tempDir, "workspace");
		mkdirSync(workspaceRoot, { recursive: true });
		writeFileSync(
			join(workspaceRoot, "figma-console.project.json"),
			JSON.stringify({
				version: 2,
			}),
			"utf8",
		);

		const state = loadProjectPolicy({ cwd: workspaceRoot, env: {} });

		expect(state.status).toBe("error");
		expect(state.error).toContain("version");
		expect(state.policy).toBeNull();
	});

	it("summarizes loaded policy metadata for runtime status", () => {
		const workspaceRoot = join(tempDir, "workspace");
		mkdirSync(workspaceRoot, { recursive: true });
		writeFileSync(
			join(workspaceRoot, "figma-console.project.json"),
			JSON.stringify({
				version: 1,
				projectName: "Acme Dashboard",
				mockups: {
					preferredFonts: ["Inter", "IBM Plex Sans"],
					preferredComponents: {
						buttons: ["Button/Primary"],
						inputs: ["Input/Text"],
					},
					componentLibraries: [
						{
							name: "Acme DS",
							fileKey: "abc123",
						},
					],
					defaultScreenPresets: [
						{
							name: "Desktop App",
							width: 1440,
							height: 1024,
						},
					],
				},
				validation: {
					requireScreenshotReview: true,
					requireLint: true,
					requireParity: false,
				},
			}),
			"utf8",
		);

		const summary = summarizeProjectPolicyState(loadProjectPolicy({ cwd: workspaceRoot, env: {} }));

		expect(summary.status).toBe("loaded");
		expect(summary.projectName).toBe("Acme Dashboard");
		expect(summary.preferredFontCount).toBe(2);
		expect(summary.preferredComponentGroups).toEqual(["buttons", "inputs"]);
		expect(summary.componentLibraryCount).toBe(1);
		expect(summary.defaultScreenPresetCount).toBe(1);
		expect(summary.validation?.requireScreenshotReview).toBe(true);
	});
});
