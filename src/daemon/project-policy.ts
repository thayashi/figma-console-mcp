import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { z } from "zod";

const policyFileNames = [
	"figma-console.project.json",
	join(".figma-console", "project-policy.json"),
] as const;

const componentLibrarySchema = z.object({
	name: z.string().min(1),
	fileKey: z.string().min(1).optional(),
	fileUrl: z.string().url().optional(),
	notes: z.string().optional(),
}).refine((value) => Boolean(value.fileKey || value.fileUrl), {
	message: "Each component library must define fileKey or fileUrl.",
});

const namingPolicySchema = z.object({
	screenPrefix: z.string().min(1).optional(),
	layerPattern: z.string().min(1).optional(),
	variantSeparator: z.string().min(1).optional().default("/"),
});

const screenPresetSchema = z.object({
	name: z.string().min(1),
	width: z.number().positive(),
	height: z.number().positive(),
	layoutMode: z.enum(["VERTICAL", "HORIZONTAL"]).optional().default("VERTICAL"),
	padding: z.number().nonnegative().optional(),
});

const validationPolicySchema = z.object({
	requireScreenshotReview: z.boolean().optional().default(true),
	requireLint: z.boolean().optional().default(true),
	lintRules: z.array(z.string().min(1)).optional().default(["all"]),
	requireParity: z.boolean().optional().default(false),
});

const mockupPolicySchema = z.object({
	preferredFonts: z.array(z.string().min(1)).optional().default([]),
	spacingScale: z.array(z.number().nonnegative()).optional().default([]),
	preferredComponents: z.record(z.array(z.string().min(1))).optional().default({}),
	componentLibraries: z.array(componentLibrarySchema).optional().default([]),
	naming: namingPolicySchema.optional(),
	defaultScreenPresets: z.array(screenPresetSchema).optional().default([]),
	notes: z.array(z.string().min(1)).optional().default([]),
});

export const projectPolicySchema = z.object({
	version: z.literal(1).optional().default(1),
	projectName: z.string().min(1).optional(),
	mockups: mockupPolicySchema.optional().default({}),
	validation: validationPolicySchema.optional().default({}),
});

export type ProjectPolicy = z.infer<typeof projectPolicySchema>;

export interface LoadedProjectPolicy {
	sourcePath: string;
	workspaceRoot: string;
	policy: ProjectPolicy;
}

export interface ProjectPolicyState {
	status: "loaded" | "not_found" | "error";
	cwd: string;
	checkedPaths: string[];
	policy: LoadedProjectPolicy | null;
	error?: string;
}

export interface ProjectPolicySummary {
	status: ProjectPolicyState["status"];
	sourcePath?: string;
	workspaceRoot?: string;
	projectName?: string;
	preferredFontCount?: number;
	preferredComponentGroups?: string[];
	componentLibraryCount?: number;
	defaultScreenPresetCount?: number;
	validation?: {
		requireScreenshotReview: boolean;
		requireLint: boolean;
		requireParity: boolean;
	};
	checkedPaths: string[];
	error?: string;
}

export interface LoadProjectPolicyOptions {
	cwd?: string;
	env?: NodeJS.ProcessEnv;
}

export function loadProjectPolicy(options: LoadProjectPolicyOptions = {}): ProjectPolicyState {
	const cwd = resolve(options.cwd || process.cwd());
	const env = options.env || process.env;
	const envPath = env.FIGMA_PROJECT_POLICY_PATH?.trim();

	if (envPath) {
		const resolvedPath = resolve(cwd, envPath);
		if (!existsSync(resolvedPath)) {
			return {
				status: "error",
				cwd,
				checkedPaths: [resolvedPath],
				policy: null,
				error: `FIGMA_PROJECT_POLICY_PATH points to a missing file: ${resolvedPath}`,
			};
		}

		return loadPolicyFromPath(cwd, resolvedPath, [resolvedPath]);
	}

	const checkedPaths = discoverPolicyPaths(cwd);
	for (const candidatePath of checkedPaths) {
		if (!existsSync(candidatePath)) {
			continue;
		}
		return loadPolicyFromPath(cwd, candidatePath, checkedPaths);
	}

	return {
		status: "not_found",
		cwd,
		checkedPaths,
		policy: null,
	};
}

export function summarizeProjectPolicyState(state: ProjectPolicyState): ProjectPolicySummary {
	if (!state.policy) {
		return {
			status: state.status,
			checkedPaths: state.checkedPaths,
			error: state.error,
		};
	}

	const { policy, sourcePath, workspaceRoot } = state.policy;
	return {
		status: state.status,
		sourcePath,
		workspaceRoot,
		projectName: policy.projectName,
		preferredFontCount: policy.mockups.preferredFonts.length,
		preferredComponentGroups: Object.keys(policy.mockups.preferredComponents).sort((a, b) => a.localeCompare(b)),
		componentLibraryCount: policy.mockups.componentLibraries.length,
		defaultScreenPresetCount: policy.mockups.defaultScreenPresets.length,
		validation: {
			requireScreenshotReview: policy.validation.requireScreenshotReview,
			requireLint: policy.validation.requireLint,
			requireParity: policy.validation.requireParity,
		},
		checkedPaths: state.checkedPaths,
	};
}

function discoverPolicyPaths(startDir: string): string[] {
	const checkedPaths: string[] = [];
	const seen = new Set<string>();
	let currentDir = startDir;

	while (true) {
		for (const fileName of policyFileNames) {
			const candidate = join(currentDir, fileName);
			if (!seen.has(candidate)) {
				seen.add(candidate);
				checkedPaths.push(candidate);
			}
		}

		const parentDir = dirname(currentDir);
		if (parentDir === currentDir) {
			break;
		}
		currentDir = parentDir;
	}

	return checkedPaths;
}

function loadPolicyFromPath(cwd: string, sourcePath: string, checkedPaths: string[]): ProjectPolicyState {
	try {
		const raw = readFileSync(sourcePath, "utf8");
		const parsed = JSON.parse(raw) as unknown;
		const policy = projectPolicySchema.parse(parsed);

		return {
			status: "loaded",
			cwd,
			checkedPaths,
			policy: {
				sourcePath,
				workspaceRoot: resolveWorkspaceRoot(sourcePath),
				policy,
			},
		};
	} catch (error) {
		const message = formatProjectPolicyError(error);
		return {
			status: "error",
			cwd,
			checkedPaths,
			policy: null,
			error: `Failed to load project policy from ${sourcePath}: ${message}`,
		};
	}
}

function formatProjectPolicyError(error: unknown): string {
	if (error instanceof z.ZodError) {
		return error.issues
			.map((issue) => {
				const issuePath = issue.path.length > 0 ? issue.path.join(".") : "root";
				return `${issuePath}: ${issue.message}`;
			})
			.join("; ");
	}

	if (error instanceof Error) {
		return error.message;
	}

	return String(error);
}

function resolveWorkspaceRoot(sourcePath: string): string {
	const parentDir = dirname(sourcePath);
	if (basename(parentDir) === ".figma-console") {
		return dirname(parentDir);
	}
	return parentDir;
}
