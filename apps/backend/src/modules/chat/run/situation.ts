import type { Env } from "../../../config/env";
import type { Db } from "../../../db";
import { adminTools } from "../../agent/admin";
import type { AgentBot } from "../../agent/agent";
import { createGroupTools } from "../../groups/tools";
import type { GroupMember } from "../../groups/store";
import type { ChatRunParams } from "./types";

/** Tools this run adds for where the bot is: a group chat's (hand-offs, group notes) and the admin bot's. */
export function situationTools(env: Env, db: Db, params: ChatRunParams, bot: AgentBot, group?: { groupId: string; members: GroupMember[] }) {
  const admin = bot.kind === "admin" ? adminTools({ env, db, userId: params.userId, botId: bot.id, modelId: params.modelId }) : null;
  return {
    extraTools: [...(group ? createGroupTools({ db, groupId: group.groupId, botId: bot.id, members: group.members }) : []), ...(admin?.tools ?? [])],
    extraApprovals: admin?.approvals ?? {},
  };
}
