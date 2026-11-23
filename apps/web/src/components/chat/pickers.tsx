"use client";

import { type Effort, models, visionModels } from "@repo/shared/models";
import {
	BrainIcon,
	ChevronDownIcon,
	EyeIcon,
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

const providers = [...new Set(models.map((m) => m.provider))].map((name) => ({
	name,
	models: models.filter((m) => m.provider === name),
}));

const effortNames: Record<Effort, string> = {
	none: "Off",
	minimal: "Minimal",
	low: "Low",
	medium: "Medium",
	high: "High",
	xhigh: "Extra high",
};

const modes = [
	{ id: "ask", name: "Ask", icon: MessageCircleQuestionIcon },
	{ id: "plan", name: "Plan", icon: ListChecksIcon },
	{ id: "full", name: "Full", icon: ZapIcon },
];

export const defaultMode = "ask";

type PickerProps = { value: string; onChange: (v: string) => void };

// Model + reasoning effort in one menu. The effort list follows the model.
export function ModelPicker({
	model,
	effort,
	onModel,
	onEffort,
}: {
	model: string;
	effort: string | undefined;
	onModel: (v: string) => void;
	onEffort: (v: Effort) => void;
}) {
	const m = models.find((x) => x.id === model) ?? models[0];
	const e = m.efforts.find((x) => x === effort) ?? m.defaultEffort;
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<InputGroupButton
						size="sm"
						variant="outline"
						aria-label={`Model: ${m.name}${e ? `, reasoning: ${effortNames[e]}` : ""}`}
						className="min-w-0"
					/>
				}
			>
				<span className="max-w-24 truncate sm:max-w-40">{m.name}</span>
				{e && (
					<span className="hidden text-muted-foreground sm:inline">
						{effortNames[e]}
					</span>
				)}
				<ChevronDownIcon />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" side="top" className="w-56">
				<DropdownMenuRadioGroup value={m.id} onValueChange={onModel}>
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
				{m.efforts.length > 0 && (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuLabel className="flex items-center gap-1.5">
								<BrainIcon className="size-3.5" />
								Reasoning
							</DropdownMenuLabel>
							<DropdownMenuRadioGroup
								value={e}
								onValueChange={(v) => onEffort(v as Effort)}
							>
								{m.efforts.map((item) => (
									<DropdownMenuRadioItem key={item} value={item} closeOnClick>
										{effortNames[item]}
									</DropdownMenuRadioItem>
								))}
							</DropdownMenuRadioGroup>
						</DropdownMenuGroup>
					</>
				)}
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

// Shown only for a text-only model: which model reads images for it (view_file).
export function VisionPicker({ value, onChange }: PickerProps) {
	const current = visionModels.find((x) => x.id === value) ?? visionModels[0];
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<InputGroupButton
						size="sm"
						variant="outline"
						aria-label={`Vision model: ${current.name}`}
						title="This model reads text only; this one reads images for it"
						className="min-w-0"
					/>
				}
			>
				<EyeIcon />
				<span className="hidden truncate sm:inline">{current.name}</span>
				<ChevronDownIcon />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" side="top" className="w-56">
				<DropdownMenuGroup>
					<DropdownMenuLabel>Reads images for this model</DropdownMenuLabel>
					<DropdownMenuRadioGroup value={current.id} onValueChange={onChange}>
						{visionModels.map((item) => (
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
