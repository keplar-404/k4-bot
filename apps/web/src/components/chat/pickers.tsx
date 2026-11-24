"use client";

import { type Effort, models, visionModels } from "@repo/shared/models";
import {
	BrainIcon,
	CheckIcon,
	ChevronDownIcon,
	EyeIcon,
	ListChecksIcon,
	MessageCircleQuestionIcon,
	SparklesIcon,
	ZapIcon,
} from "lucide-react";
import { Fragment, useState } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Glide } from "@/components/ui/glide";
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

// models.dev serves each provider's mark as a one-colour SVG (black: inverted in dark).
const logoSlug: Record<string, string> = { "Z.ai": "zai" };
function ProviderLogo({ provider }: { provider: string }) {
	return (
		// biome-ignore lint/performance/noImgElement: tiny remote provider mark
		<img
			src={`https://models.dev/logos/${logoSlug[provider] ?? provider.toLowerCase()}.svg`}
			alt=""
			className="size-3.5 shrink-0 dark:invert"
			onError={(e) => {
				e.currentTarget.style.visibility = "hidden";
			}}
		/>
	);
}

// Models by provider. A model with reasoning opens a submenu of its efforts: pick one
// there, or click the model itself for its default effort.
// ponytail: a plain menu; add a search box and provider rail once the list is long.
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
	const [open, setOpen] = useState(false);
	const m = models.find((x) => x.id === model) ?? models[0];
	const e = m.efforts.find((x) => x === effort) ?? m.defaultEffort;
	const pick = (id: string, effort?: Effort) => {
		onModel(id); // resets the effort to the model's default
		if (effort) onEffort(effort);
		setOpen(false);
	};
	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
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
				<ProviderLogo provider={m.provider} />
				<span className="max-w-24 truncate sm:max-w-40">{m.name}</span>
				{e && (
					<span className="hidden text-muted-foreground sm:inline">
						{effortNames[e]}
					</span>
				)}
				<ChevronDownIcon />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" side="top" className="w-60">
				<Glide items="[role^=menuitem]" />
				{providers.map((p, i) => (
					<Fragment key={p.name}>
						{i > 0 && <DropdownMenuSeparator />}
						<DropdownMenuGroup>
							<DropdownMenuLabel>{p.name}</DropdownMenuLabel>
							{p.models.map((item) => {
								const row = (
									<>
										<ProviderLogo provider={item.provider} />
										<span className="min-w-0 flex-1 truncate">{item.name}</span>
										{item.flagship && (
											<SparklesIcon
												aria-label="Top model"
												className="size-3.5! text-primary"
											/>
										)}
										{item.id === m.id && <CheckIcon className="size-3.5!" />}
									</>
								);
								return item.efforts.length ? (
									<DropdownMenuSub key={item.id}>
										<DropdownMenuSubTrigger onClick={() => pick(item.id)}>
											{row}
										</DropdownMenuSubTrigger>
										<DropdownMenuSubContent className="w-44">
											<Glide items="[role^=menuitem]" />
											<DropdownMenuLabel className="flex items-center gap-1.5">
												<BrainIcon className="size-3.5" />
												Reasoning
											</DropdownMenuLabel>
											<DropdownMenuRadioGroup
												value={item.id === m.id ? e : null}
												onValueChange={(v) => pick(item.id, v as Effort)}
											>
												{item.efforts.map((x) => (
													<DropdownMenuRadioItem key={x} value={x}>
														{effortNames[x]}
														{x === item.defaultEffort && (
															<span className="text-xs text-muted-foreground">
																default
															</span>
														)}
													</DropdownMenuRadioItem>
												))}
											</DropdownMenuRadioGroup>
										</DropdownMenuSubContent>
									</DropdownMenuSub>
								) : (
									<DropdownMenuItem key={item.id} onClick={() => pick(item.id)}>
										{row}
										{/* lines up with the chevron of the rows above */}
										<span className="size-4 shrink-0" />
									</DropdownMenuItem>
								);
							})}
						</DropdownMenuGroup>
					</Fragment>
				))}
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
				<Glide items="[role^=menuitem]" />
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
				<Glide items="[role^=menuitem]" />
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
