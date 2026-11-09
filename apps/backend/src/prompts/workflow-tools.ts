/** What the bot's workflow tools (create_workflow, update_workflow) say about blocks and references. */
export const BLOCKS_HELP = [
  "Blocks: trigger.manual | trigger.webhook |",
  "trigger.schedule{mode:every|once|daily|weekly|monthly, every,unit (every), at:'HH:MM', date:'YYYY-MM-DD' (once), days:[0-6] (weekly, 0=Sunday), dayOfMonth (monthly), timezone} |",
  "trigger.app{toolkit,trigger,config} (an app event; find it with app_find_events),",
  "action.app{toolkit,tool,version,arguments,connectedAccountId?},",
  "action.http{method,url,headers,body,timeoutSeconds,expect},",
  "ai.bot{botId,prompt,output:text|json,useApps,files?:[fileId]} (a bot writes or decides; output.text or output.json.<field>),",
  "logic.if | logic.filter{combine,conditions[{left,op,right}]}, logic.delay{amount,unit}, logic.set{fields[{key,value}]},",
  "logic.loop{items:'{{…list}}',max} (every block after it runs once per item, read {{loop.item}} / {{loop.index}}; one per workflow),",
  "logic.approval{message,timeoutHours} (waits until the user approves in the builder; declined stops the path).",
  "One trigger, no cycles; connections from logic.if need branch true|false.",
].join(" ");

export const TEMPLATES_HELP =
  "In text fields use {{trigger.inputs.x}} (manual), {{trigger.body.x}} (webhook), {{trigger.data.x}} (app event), {{steps.<blockId>.output.x}}, {{loop.item.x}} (inside a loop) and {{secrets.NAME}}.";
