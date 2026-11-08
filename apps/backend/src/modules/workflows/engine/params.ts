/** A run's Workflow payload: ids only. The graph and input are read from the saved run, so what runs is what was saved. */
export type RunParams = { runId: string; workflowId: string; userId: string };
