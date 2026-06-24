"use client";

import { useState } from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
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

  async function runSearch() {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      setResults(await searchPlaces(query));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-w-0">
      <p
        className={hideLabel
          ? "sr-only"
          : "mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"}
      >
        {label}
      </p>
      <div className="flex min-h-12 min-w-0 items-center gap-2 overflow-hidden rounded-2xl border border-border bg-muted px-3 py-1.5 shadow-inner">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <Input
          className="min-w-0 flex-1 truncate border-0 bg-transparent px-0 text-sm shadow-none focus:ring-0 sm:text-base"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void runSearch();
            }
          }}
          placeholder="Search city, road, landmark"
          value={query}
        />
        <Button className="h-9 shrink-0 rounded-full px-3 sm:px-4" onClick={() => void runSearch()} size="sm">
          {loading ? "..." : "Go"}
        </Button>
      </div>
      {results.length ? (
        <div className="mt-2 grid max-h-44 min-w-0 gap-2 overflow-y-auto overflow-x-hidden rounded-2xl border border-border bg-card p-2 shadow-xl">
          {results.map((result) => (
            <button
              className="min-w-0 rounded-xl p-3 text-left text-sm transition hover:bg-secondary"
              key={`${result.lat}-${result.lng}`}
              onClick={() => {
                onSelect(result);
                setQuery(result.label);
                setResults([]);
              }}
              type="button"
            >
              <span className="line-clamp-2 break-words">{result.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}


