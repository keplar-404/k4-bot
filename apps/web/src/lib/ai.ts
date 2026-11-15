import type { UIDataTypes, UIMessage } from "ai";

export type ChatMessage = UIMessage<
	unknown,
	UIDataTypes,
	{
		runCommand: {
			input: { command: string };
			output: { stdout: string };
		};
	}
>;

export const getMessageText = (message: UIMessage) =>
	message.parts.flatMap((p) => (p.type === "text" ? [p.text] : [])).join("");
