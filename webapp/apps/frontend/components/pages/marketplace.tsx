"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAnalytics } from "@/providers/analytics-provider";
import { Button } from "@droiduse/shared-ui/button";
import { Input } from "@droiduse/shared-ui/input";
import { Badge } from "@droiduse/shared-ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@droiduse/shared-ui/tabs";
import { Slider } from "@droiduse/shared-ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@droiduse/shared-ui/select";
import { SkillCard, SkillCardSkeleton } from "@/components/skill-card";
import { Search, Filter, X, Flame, Star, TrendingUp } from "lucide-react";
import type { SkillWithApp } from "@droiduse/shared-lib";

type TabValue = "hottest" | "featured" | "newest";
type SortValue = "score" | "downloads" | "newest";

export default function Marketplace() {
  const analytics = useAnalytics()
  const [tab, setTab] = useState<TabValue>("hottest");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortValue>("score");
  const [scoreRange, setScoreRange] = useState([0, 100]);
  const [showFilters, setShowFilters] = useState(false);

  const { data: skillList, isLoading } = useQuery<SkillWithApp[]>({
    queryKey: ["/api/skills", { tab, search, sort, scoreRange }],
  });

  const clearFilters = useCallback(() => {
    setSearch("");
    setScoreRange([0, 100]);
    setSort("score");
  }, []);

  const hasActiveFilters = search || scoreRange[0] > 0 || scoreRange[1] < 100;

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Marketplace</h1>
          <p className="mt-2 text-muted-foreground">
            Browse skill entries for Android apps
          </p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)} className="mb-6">
          <TabsList>
            <TabsTrigger value="hottest" data-testid="tab-hottest" className="gap-1.5">
              <Flame className="h-4 w-4" />
              Hottest
            </TabsTrigger>
            <TabsTrigger value="featured" data-testid="tab-featured" className="gap-1.5">
              <Star className="h-4 w-4" />
              Featured
            </TabsTrigger>
            <TabsTrigger value="newest" data-testid="tab-newest" className="gap-1.5">
              <TrendingUp className="h-4 w-4" />
              New Trending
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-col lg:flex-row gap-6">
          <aside className={`lg:w-64 flex-shrink-0 space-y-6 ${showFilters ? "block" : "hidden lg:block"}`}>
            <div className="rounded-lg border border-border bg-card p-4 space-y-6">
              <div>
                <h3 className="font-semibold mb-3">Score Range</h3>
                <Slider
                  value={scoreRange}
                  onValueChange={setScoreRange}
                  onValueCommit={(value) => {
                    if (value[0] !== 0 || value[1] !== 100) {
                      analytics.capture("marketplace_filtered", {
                        filter_type: "score_range",
                        score_min: value[0],
                        score_max: value[1],
                        tab: tab,
                      });
                    }
                  }}
                  max={100}
                  step={1}
                  className="mb-2"
                  data-testid="slider-score-range"
                />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{scoreRange[0]}</span>
                  <span>{scoreRange[1]}</span>
                </div>
              </div>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="w-full gap-2"
                  data-testid="button-clear-filters"
                >
                  <X className="h-4 w-4" />
                  Clear Filters
                </Button>
              )}
            </div>
          </aside>

          <main className="flex-1">
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by app name, package, or keyword..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onBlur={() => {
                    if (search.trim()) {
                      analytics.capture("marketplace_searched", {
                        search_query: search,
                        tab: tab,
                        results_count: skillList?.length ?? 0,
                      });
                    }
                  }}
                  className="pl-9"
                  data-testid="input-search-marketplace"
                />
              </div>
              <div className="flex gap-2">
                <Select value={sort} onValueChange={(v) => setSort(v as SortValue)}>
                  <SelectTrigger className="w-40" data-testid="select-sort">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="score">Top Rated</SelectItem>
                    <SelectItem value="downloads">Most Used</SelectItem>
                    <SelectItem value="newest">Newest</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  className="lg:hidden"
                  onClick={() => setShowFilters(!showFilters)}
                  data-testid="button-toggle-filters"
                >
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {hasActiveFilters && (
              <div className="flex flex-wrap gap-2 mb-4">
                {search && (
                  <Badge variant="secondary" className="gap-1">
                    Search: {search}
                    <button onClick={() => setSearch("")} className="ml-1">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {(scoreRange[0] > 0 || scoreRange[1] < 100) && (
                  <Badge variant="secondary" className="gap-1">
                    Score: {scoreRange[0]}-{scoreRange[1]}
                    <button onClick={() => setScoreRange([0, 100])} className="ml-1">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
              </div>
            )}

            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkillCardSkeleton key={i} />
                ))}
              </div>
            ) : skillList && skillList.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {skillList.map((skill) => (
                  <SkillCard key={skill.id} skill={skill} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                  <Search className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold mb-2">No skills found</h3>
                <p className="text-muted-foreground mb-4">
                  Try adjusting your search or filters
                </p>
                <Button variant="outline" onClick={clearFilters} data-testid="button-clear-empty">
                  Clear Filters
                </Button>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
