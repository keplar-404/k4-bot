"use client"

import * as React from "react"
import { SearchIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavProjects({
  projects,
}: {
  projects: {
    name: string
    url: string
    icon: React.ReactNode
  }[]
}) {
  const [open, setOpen] = React.useState(false)

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <div className="flex items-center justify-between">
        <SidebarGroupLabel>Bots</SidebarGroupLabel>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button variant="ghost" size="icon-sm" className="mr-1" />
            }
          >
            <SearchIcon />
            <span className="sr-only">Search bots</span>
          </DialogTrigger>
          <DialogContent className="p-0">
            <DialogHeader className="px-4 pt-4">
              <DialogTitle>Search bots</DialogTitle>
            </DialogHeader>
            <Command>
              <CommandInput placeholder="Search bots..." />
              <CommandList>
                <CommandEmpty>No bots found.</CommandEmpty>
                <CommandGroup heading="Bots">
                  {projects.map((item) => (
                    <CommandItem
                      key={item.name}
                      onSelect={() => {
                        window.location.href = item.url
                        setOpen(false)
                      }}
                    >
                      {item.icon}
                      <span>{item.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </DialogContent>
        </Dialog>
      </div>
      <SidebarMenu>
        {projects.map((item) => (
          <SidebarMenuItem key={item.name}>
            <SidebarMenuButton render={<a href={item.url} />}>
              {item.icon}
              <span>{item.name}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}