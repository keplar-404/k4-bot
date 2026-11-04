import { AIMessage, type BaseMessage, HumanMessage } from "@langchain/core/messages";
import { createMiddleware, type Todo } from "langchain";

/** Marks the guard's own messages, so they are told apart from the user's and counted. */
export const REMINDER_TAG = "[Automatic reminder]";
const MAX_REMINDERS = 2;

const isReminder = (m: BaseMessage) => HumanMessage.isInstance(m) && typeof m.content === "string" && m.content.startsWith(REMINDER_TAG);

/**
 * What to tell the model when it ends its turn, or null to let it end. Only this turn counts (since the user's last
 * real message): at most two reminders, first about unfinished todos, then one request to verify a long piece of work.
 */
export function reminderFor(messages: BaseMessage[], todos: Todo[]): string | null {
  const last = messages.at(-1);
  if (!last || !AIMessage.isInstance(last) || (last.tool_calls?.length ?? 0) > 0) return null;
  let start = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (HumanMessage.isInstance(m) && !isReminder(m)) {
      start = i;
      break;
    }
  }
  const turn = messages.slice(start);
  const sent = turn.filter(isReminder).length;
  if (sent >= MAX_REMINDERS) return null;
  const unfinished = todos.filter((t) => t.status === "pending" || t.status === "in_progress");
  if (unfinished.length > 0) {
    return `${REMINDER_TAG} You still have unfinished todos: ${unfinished.map((t) => t.content).join("; ")}. Finish them, or mark them done or cancelled with write_todos and say why.`;
  }
  const toolCalls = turn.reduce((n, m) => n + (AIMessage.isInstance(m) ? (m.tool_calls?.length ?? 0) : 0), 0);
  if (toolCalls >= 3 && sent === 0) {
    return `${REMINDER_TAG} Before answering: check each todo is done and verify the result (re-read files you wrote, re-run what you built, confirm facts you cite). If all is right, give your final answer.`;
  }
  return null;
}

/**
 * Keeps the bot on its plan (Deep Agents' `write_todos` keeps `todos` in state): when it stops early, a reminder is
 * added as a user-side message and the model runs again (`jumpTo: "model"`). Not a system message, which providers
 * reject in the middle of a conversation.
 */
export function createTodoGuardMiddleware() {
  return createMiddleware({
    name: "TodoGuardMiddleware",
    afterModel: {
      canJumpTo: ["model"],
      hook: (state) => {
        const s = state as { messages: BaseMessage[]; todos?: Todo[] };
        const text = reminderFor(s.messages, s.todos ?? []);
        return text ? { messages: [new HumanMessage(text)], jumpTo: "model" as const } : undefined;
      },
    },
  });
}
