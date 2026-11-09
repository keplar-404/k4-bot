"use client";

import type { BlockBody } from "../blocks";
import { RetrySettings } from "./retry-settings";

type WithRetry = Extract<BlockBody, { onError: "stop" | "continue" }>;

/** Blocks that call the outside world (apps, HTTP, a bot) can retry and can let the run go on when they fail. */
export const hasOptions = (b: BlockBody): b is WithRetry => "onError" in b;

export function BlockOptions({
  block,
  update,
}: {
  block: WithRetry;
  update: (b: BlockBody) => void;
}) {
  return (
    <RetrySettings
      retry={block.retry}
      onError={block.onError}
      onRetry={(retry) => update({ ...block, retry })}
      onOnError={(onError) => update({ ...block, onError })}
    />
  );
}
