"use client";

import { useEffect, useId, useState } from "react";
import { LoaderCircle, Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { searchPlaces, type SearchResult } from "@/lib/maps";

export function LocationSearch({
  hideLabel = false,
  label,
  onSelect,
  selectedValue,
}: {
  hideLabel?: boolean;
  label: string;
  onSelect: (place: SearchResult) => void;
  selectedValue?: string;
}) {
  const [query, setQuery] = useState(selectedValue ?? "");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");
  const listId = useId();

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 3 || normalized === selectedValue) return undefined;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setStatus("");
      try {
        const places = await searchPlaces(normalized, controller.signal);
        setResults(places);
        setOpen(true);
        setStatus(places.length ? "" : "No matching locations found.");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("Location suggestions are unavailable. Try again.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, selectedValue]);

  return (
    <div className="relative min-w-0">
      <p className={hideLabel ? "sr-only" : "mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"}>
        {label}
      </p>
      <div className="relative flex min-h-12 min-w-0 items-center gap-2 rounded-lg border border-border bg-muted px-3 py-1.5 shadow-inner transition focus-within:border-primary/30 focus-within:bg-card focus-within:ring-2 focus-within:ring-ring/60">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <Input
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open && (loading || Boolean(results.length) || Boolean(status))}
          autoComplete="off"
          className="min-w-0 flex-1 truncate border-0 bg-transparent px-0 text-sm shadow-none focus:ring-0 sm:text-base"
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            setOpen(true);
            setStatus("");
            if (value.trim().length < 3) {
              setResults([]);
              setLoading(false);
            }
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search city, road, landmark"
          role="combobox"
          value={query}
        />
        {loading ? <LoaderCircle aria-label="Searching locations" className="size-4 shrink-0 animate-spin text-primary" /> : null}
        {query ? (
          <button
            aria-label={`Clear ${label.toLowerCase()} search`}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg hover:bg-card"
            onClick={() => {
              setQuery("");
              setResults([]);
              setOpen(false);
            }}
            type="button"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>
      {open && (results.length || status) ? (
        <div className="absolute z-[1500] mt-2 grid max-h-56 w-full min-w-0 gap-1 overflow-y-auto overflow-x-hidden rounded-lg border border-border bg-card p-2 shadow-[var(--shadow-float)]" id={listId} role="listbox">
          {results.map((result) => (
            <button
              aria-selected="false"
              className="min-w-0 rounded-md p-3 text-left text-sm transition hover:bg-secondary focus:bg-secondary focus:outline-none"
              key={`${result.lat}-${result.lng}`}
              onMouseDown={(event) => {
                event.preventDefault();
                onSelect(result);
                setQuery(result.label);
                setResults([]);
                setOpen(false);
              }}
              role="option"
              type="button"
            >
              <span className="line-clamp-2 break-words">{result.label}</span>
            </button>
          ))}
          {status ? <p className="px-3 py-2 text-sm text-muted-foreground">{status}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
