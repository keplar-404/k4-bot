// What the agent's tools return. The tools produce these and the web chat renders
// them, so a change here is a type error on both sides instead of a blank tool row.

export type SearchOutput = {
	query: string;
	results: { url: string; title: string; snippet: string; markdown?: string }[];
};

export type DesktopOutput = {
	action: string;
	streamUrl: string;
	/** Object-storage key of the screenshot taken after the action. */
	screenshotKey: string;
	command?: string;
	stdout?: string;
	stderr?: string;
	exitCode?: number;
};
