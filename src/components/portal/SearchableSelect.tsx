import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type SearchableSelectOption = { value: string; label: string };

type Props = {
  id?: string;
  value: string;
  options: readonly SearchableSelectOption[] | readonly string[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  emptyText?: string;
  /** Allow clearing the selection back to empty string. */
  allowClear?: boolean;
};

function normalizeOptions(
  options: readonly SearchableSelectOption[] | readonly string[],
): SearchableSelectOption[] {
  return options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
}

/** Accessible searchable single-select for long intake catalogs. */
export function SearchableSelect({
  id,
  value,
  options,
  onChange,
  placeholder = "Select…",
  disabled,
  emptyText = "No matches.",
  allowClear = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const items = useMemo(() => normalizeOptions(options), [options]);
  const selected = items.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative mt-1.5">
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "h-10 w-full justify-between font-normal",
              selected && "border-royal/40 bg-royal/[0.03]",
              allowClear && selected ? "pr-9" : "",
            )}
          >
            <span className={cn("truncate text-left", !selected && "text-muted-foreground")}>
              {selected?.label ?? placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        {allowClear && selected && !disabled ? (
          <button
            type="button"
            aria-label="Clear selection"
            className="absolute right-8 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-navy"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onChange("");
              setOpen(false);
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search…" />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.value || `empty-${item.label}`}
                  value={item.label}
                  onSelect={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === item.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
