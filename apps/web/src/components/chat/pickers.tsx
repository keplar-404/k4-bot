"use client";

import {
	BrainIcon,
	ChevronDownIcon,
	ListChecksIcon,
	MessageCircleQuestionIcon,
	ZapIcon,
} from "lucide-react";
import { Fragment } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroupButton } from "@/components/ui/input-group";

const providers = [
	{
		name: "Anthropic",
		models: [
			{ id: "claude-sonnet-5-5", name: "Sonnet 5.5" },
			{ id: "claude-haiku-5-5", name: "Haiku 5.5" },
		],
	},
	{
		name: "OpenAI",
		models: [
			{ id: "gpt-5", name: "GPT-5" },
			{ id: "gpt-5-mini", name: "GPT-5 mini" },
		],
	},
];
const models = providers.flatMap((p) => p.models);

const efforts = [
	{ id: "low", name: "Low" },
	{ id: "medium", name: "Medium" },
	{ id: "high", name: "High" },
];

const modes = [
	{ id: "ask", name: "Ask", icon: MessageCircleQuestionIcon },
	{ id: "plan", name: "Plan", icon: ListChecksIcon },
	{ id: "full", name: "Full", icon: ZapIcon },
];

export const defaultModel = models[0].id;
export const defaultEffort = "medium";
export const defaultMode = "ask";

type PickerProps = { value: string; onChange: (v: string) => void };

// Model + reasoning effort in one menu.
export function ModelPicker({
	model,
	effort,
	onModel,
	onEffort,
}: {
	model: string;
	effort: string;
	onModel: (v: string) => void;
	onEffort: (v: string) => void;
}) {
	const m = models.find((x) => x.id === model) ?? models[0];
	const e = efforts.find((x) => x.id === effort) ?? efforts[1];
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<InputGroupButton
						size="sm"
						variant="outline"
						aria-label={`Model: ${m.name}, reasoning: ${e.name}`}
						className="min-w-0"
					/>
				}
			>
				<span className="truncate">{m.name}</span>
				<span className="hidden text-muted-foreground sm:inline">{e.name}</span>
				<ChevronDownIcon />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" side="top" className="w-52">
				<DropdownMenuRadioGroup value={model} onValueChange={onModel}>
					{providers.map((p, i) => (
						<Fragment key={p.name}>
							{i > 0 && <DropdownMenuSeparator />}
							<DropdownMenuGroup>
								<DropdownMenuLabel>{p.name}</DropdownMenuLabel>
								{p.models.map((item) => (
									<DropdownMenuRadioItem
										key={item.id}
										value={item.id}
										closeOnClick
									>
										{item.name}
									</DropdownMenuRadioItem>
								))}
							</DropdownMenuGroup>
						</Fragment>
					))}
				</DropdownMenuRadioGroup>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuLabel className="flex items-center gap-1.5">
						<BrainIcon className="size-3.5" />
						Reasoning
					</DropdownMenuLabel>
					<DropdownMenuRadioGroup value={effort} onValueChange={onEffort}>
						{efforts.map((item) => (
							<DropdownMenuRadioItem key={item.id} value={item.id} closeOnClick>
								{item.name}
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function ModePicker({ value, onChange }: PickerProps) {
	const current = modes.find((x) => x.id === value) ?? modes[0];
	const Icon = current.icon;
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<InputGroupButton
						size="sm"
						variant="outline"
						aria-label={`Mode: ${current.name}`}
					/>
				}
			>
				<Icon />
				<span className="hidden sm:inline">{current.name}</span>
				<ChevronDownIcon />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" side="top" className="w-36">
				<DropdownMenuGroup>
					<DropdownMenuLabel>Mode</DropdownMenuLabel>
					<DropdownMenuRadioGroup value={value} onValueChange={onChange}>
						{modes.map((item) => (
							<DropdownMenuRadioItem key={item.id} value={item.id} closeOnClick>
								<item.icon />
								{item.name}
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
