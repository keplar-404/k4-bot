/** The scope a live-socket token is signed for, so a chat token can never open a workflow socket (or the reverse). */
export const liveScope = (workflowId: string) => `workflow-live:${workflowId}`;
