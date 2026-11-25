"use client";

import {
	type Effort,
	type ModelOption,
	models,
	visionModels,
} from "@repo/shared/models";
import {
	CheckIcon,
	ChevronDownIcon,
	EyeIcon,
	KeyRoundIcon,
	ListChecksIcon,
	MessageCircleQuestionIcon,
	SearchIcon,
	SparklesIcon,
	ZapIcon,
} from "lucide-react";
import { useState } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Glide } from "@/components/ui/glide";
import { InputGroupButton } from "@/components/ui/input-group";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useOwnModels } from "@/lib/providers";

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

// models.dev serves each provider's mark as a one-colour SVG (black: inverted in dark),
// named by its provider id; the names here are display names, so map the odd ones.
const logoSlug: Record<string, string> = {
	"Z.ai": "zai",
	"Z.AI": "zai",
	"Together AI": "togetherai",
	"Fireworks AI": "fireworks-ai",
	"Deep Infra": "deepinfra",
	"Moonshot AI": "moonshotai",
	"Hugging Face": "huggingface",
	"Novita AI": "novita-ai",
	"Ollama Cloud": "ollama-cloud",
	"GMI Cloud": "gmicloud",
	"Perplexity Agent": "perplexity",
};
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

// "1M", "128K": the context window, as the list shows it.
const tokens = (n: number) =>
	n >= 1e6 ? `${Math.round(n / 1e6)}M` : `${Math.round(n / 1e3)}K`;

// Tabs for where the model runs (K4's OpenRouter, then each provider the user added a
// key for in Settings > Model providers), a search
// line, then that gateway's models grouped by lab, one line each. The chosen model's
// details and reasoning levels sit in the footer: clicking a model with levels
// selects it and keeps the panel open on them; a level (or a model without levels)
// closes it. Enter picks the first match.
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
	const [query, setQuery] = useState("");
	const own = useOwnModels();
	const all = [...models, ...own];
	// The user's own key for a provider we also host (OpenRouter) gets its own tab.
	const tabOf = (x: ModelOption) =>
		x.id.startsWith("byok:") ? `byok:${x.via}` : x.via;
	const tabs = [...new Set(all.map(tabOf))];
	const m = all.find((x) => x.id === model) ?? models[0];
	const [via, setVia] = useState(tabOf(m));
	const viaName = via.replace(/^byok:/, "");
	const e = m.efforts.find((x) => x === effort) ?? m.defaultEffort;
	const q = query.trim().toLowerCase();
	const shown = all.filter(
		(x) =>
			tabOf(x) === via &&
			`${x.name} ${x.provider} ${x.description}`.toLowerCase().includes(q),
	);
	const labs = [...new Set(shown.map((x) => x.provider))];
	const close = () => {
		setOpen(false);
		setQuery("");
	};
	const choose = (id: string) => {
		onModel(id); // resets the effort to the model's default
		if (!all.find((x) => x.id === id)?.efforts.length) close();
	};
	return (
		<Popover
			open={open}
			onOpenChange={(o) => {
				if (!o) return close();
				setVia(tabOf(m));
				setOpen(true);
			}}
		>
			<PopoverTrigger
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
			</PopoverTrigger>
			<PopoverContent
				align="start"
				side="top"
				className="w-[min(22rem,calc(100vw-1.5rem))] gap-0 overflow-hidden p-0"
			>
				<Tabs value={via} onValueChange={(v) => setVia(String(v))}>
					<TabsList
						variant="line"
						className="w-full justify-start overflow-x-auto px-2 pt-1"
					>
						{tabs.map((g) => {
							const name = g.replace(/^byok:/, "");
							return (
								<TabsTrigger key={g} value={g} className="flex-none text-xs">
									<ProviderLogo provider={name} />
									{name}
									{g !== name && (
										<KeyRoundIcon
											aria-label="your key"
											className="size-3 text-muted-foreground"
										/>
									)}
								</TabsTrigger>
							);
						})}
					</TabsList>
				</Tabs>
				<label className="flex items-center gap-2 border-y px-3 text-muted-foreground">
					<SearchIcon className="size-3.5 shrink-0" />
					<input
						// biome-ignore lint/a11y/noAutofocus: the panel opens to search
						autoFocus
						value={query}
						onChange={(ev) => setQuery(ev.target.value)}
						onKeyDown={(ev) => {
							if (ev.key === "Enter" && shown[0]) {
								ev.preventDefault();
								choose(shown[0].id);
							}
						}}
						placeholder={`Search ${viaName} models`}
						aria-label="Search models"
						className="h-9 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
					/>
				</label>
				<div className="max-h-[min(18rem,45vh)] scroll-fade-y scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent overflow-y-auto overscroll-contain p-1">
					<Glide items="[data-model]" />
					{labs.length === 0 && (
						<p className="px-3 py-6 text-center text-xs text-muted-foreground">
							No models match “{query}”.
						</p>
					)}
					{labs.map((lab) => (
						<div key={lab}>
							<p className="px-2 pt-2 pb-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
								{lab}
							</p>
							{shown
								.filter((x) => x.provider === lab)
								.map((item) => {
									const on = item.id === m.id;
									return (
										<button
											key={item.id}
											type="button"
											data-model
											aria-pressed={on}
											title={item.description}
											onClick={() => choose(item.id)}
											className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
										>
											<ProviderLogo provider={item.provider} />
											<span
												className={`truncate ${on ? "font-medium" : "text-foreground/80"}`}
											>
												{item.name}
											</span>
											{item.flagship && (
												<SparklesIcon
													aria-label="Top model"
													className="size-3 shrink-0 text-primary"
												/>
											)}
											<span className="ml-auto font-mono text-[10px] text-muted-foreground">
												{tokens(item.contextWindow)}
											</span>
											<CheckIcon
												className={`size-3.5 shrink-0 ${on ? "" : "invisible"}`}
											/>
										</button>
									);
								})}
						</div>
					))}
				</div>
				<div className="flex flex-col gap-2 border-t bg-muted/40 px-3 py-2.5">
					<p className="text-xs text-muted-foreground">
						<span className="font-medium text-foreground">{m.name}</span>
						{" · "}
						{m.description}
						{m.vision === false && " · Text only"}
					</p>
					{m.efforts.length > 0 && (
						<ToggleGroup
							aria-label={`Reasoning for ${m.name}`}
							size="sm"
							variant="outline"
							spacing={0}
							value={e ? [e] : []}
							onValueChange={(v) => {
								if (v[0]) onEffort(v[0] as Effort);
								close();
							}}
							className="w-full"
						>
							{m.efforts.map((x) => (
								<ToggleGroupItem
									key={x}
									value={x}
									title={x === m.defaultEffort ? "Default" : undefined}
									className="h-7 flex-1 px-1.5 text-xs"
								>
									{effortNames[x]}
									{x === m.defaultEffort && (
										<>
											<span
												aria-hidden
												className="size-1 rounded-full bg-primary"
											/>
											<span className="sr-only">(default)</span>
										</>
									)}
								</ToggleGroupItem>
							))}
						</ToggleGroup>
					)}
				</div>
			</PopoverContent>
		</Popover>
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
