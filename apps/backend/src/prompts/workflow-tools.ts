/** What the bot's workflow tools (create_workflow, update_workflow) say about blocks and references. */
export const BLOCKS_HELP = [
  "Blocks: trigger.manual{fields?:[{key,label,type:text|number|yes_no|list,required}]} (a form; read {{trigger.inputs.<key>}}; run_workflow inputs must fill required fields) | trigger.webhook |",
  "trigger.schedule{mode:every|once|daily|weekly|monthly, every,unit (every), at:'HH:MM', date:'YYYY-MM-DD' (once), days:[0-6] (weekly, 0=Sunday), dayOfMonth (monthly), timezone} |",
  "trigger.app{toolkit,trigger,config} (an app event; find it with app_find_events),",
  "action.app{toolkit,tool,version,arguments,connectedAccountId?},",
  "action.http{method,url,query?:[{name,value}],auth?:{type:none|bearer|basic|api_key,token:'{{secrets.NAME}}',username?,headerName?},headers,body,timeoutSeconds,expect} (output: status, headers, body; pagination?:{mode:page|cursor|next_url,param,start,itemsPath,nextPath,maxPages≤10} collects every page's items into output.items),",
  "ai.bot{botId,prompt,output:text|json,useApps,files?:[fileId]} (a bot writes or decides; output.text or output.json.<field>),",
  "logic.if | logic.filter{combine,conditions[{left,op,right,caseSensitive?}],groups?:[{combine,conditions}] (each group counts as one condition: A and (B or C))} (op: equals, not_equals, contains, not_contains, starts_with, ends_with, gt, gte, lt, lte, exists, not_exists, is_empty, is_not_empty, length_equals, length_gt, length_lt, date_before, date_after, date_equals, is_true, is_false),",
  "logic.switch{rules[{id,label,combine,conditions}],otherwise} (first matching rule's output runs; edges from it carry branch = the rule id or \"otherwise\"),",
  "logic.delay{mode:for|until|next, amount,unit (for), until:'ISO date or {{ref}}' (until), days:[0-6],at:'HH:MM',timezone (next); at most 7 days},",
  "logic.set{fields[{key,value,type:text|number|yes_no|list|object}],base?:'{{object}}'} (base: a copy of that object with the fields set),",
  "action.code{code,inputs:[{key,value}],timeoutSeconds:1-120} (JavaScript body of an async function of `input`; `return` the result, read {{steps.<id>.output.result}}; runs in a sandbox, uses the user's daily sandbox minutes; no secrets),",
  "logic.format{operation,input,options} (no-code formatting; read {{steps.<id>.output.result}}; operation: uppercase, lowercase, capitalize, trim, replace{find,replace}, split{separator}, truncate{length}, extract_email, extract_url, extract_number, round{decimals}, add|subtract|multiply|divide{value}, format_number{decimals,locale}, format_date{timezone,dateStyle,locale}, add_time{amount,unit}, to_timezone{timezone}, join{separator}, first, last, count, unique),",
  "logic.loop{items:'{{…list}}',max} (blocks after its plain output run once per item, read {{loop.item}} / {{loop.index}}; blocks connected with branch \"done\" run once after all items and read {{steps.<loopId>.output.results}}; one per workflow),",
  "logic.merge{mode:append|combine|by_key|first,inputs:['{{…}}','{{…}}'],key} (brings 2-5 values or paths together; read .output.items (append, by_key) or .output.result (combine, first)),",
  "logic.list{operation:split_out|pluck|sum|average|min|max|count|sort|group_by|unique|first_n,input:'{{…list}}',field,order:asc|desc,amount} (one operation on a list; read .output.items or .output.result),",
  "logic.approval{message,timeoutHours,onTimeout:fail|decline} (waits until the user approves; declined stops the path),",
  "ai.decide{model,state,questions[{id,type:noul|choice|score,instructions,yes?,no?,choices?[{label,description}],levels?[]}]} (TypeSafe Jev: calibrated answers, not text; read {{steps.<id>.output.answers.<q>.noul}} (0-1 probability of yes), .choice (the label), .score (0-1 expected value, NOT a level) and .confidence; branch with logic.if using ranges such as noul gt 0.7 or score lt 0.4, never equals). Use it to route, triage or filter (is this urgent? which department? how relevant?); use ai.bot when the output must be text.",
  "One trigger, no cycles; connections from logic.if need branch true|false, from logic.switch a rule id or otherwise, from logic.loop none (each item) or done.",
].join(" ");

export const TEMPLATES_HELP =
  "In text fields use {{trigger.inputs.x}} (manual), {{trigger.body.x}} (webhook), {{trigger.data.x}} (app event), {{steps.<blockId>.output.x}}, {{loop.item.x}} (inside a loop) and {{secrets.NAME}}.";
