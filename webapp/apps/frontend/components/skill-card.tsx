"use client";

import { memo, useCallback } from "react";
import Link from "next/link";
import { useAnalytics } from "@/providers/analytics-provider";
import { Card, CardContent } from "@droiduse/shared-ui/card";
import { Badge } from "@droiduse/shared-ui/badge";
import { Button } from "@droiduse/shared-ui/button";
import { Star, Download, ArrowRight, Smartphone } from "lucide-react";
import type { SkillWithApp } from "@droiduse/shared-lib";

interface SkillCardProps {
  skill: SkillWithApp;
}

export const SkillCard = memo(function SkillCard({ skill }: SkillCardProps) {
  const analytics = useAnalytics()

  const handleClick = useCallback(() => {
    analytics.capture("skill_viewed", {
      skill_id: skill.id,
      skill_title: skill.title,
      skill_score: skill.score,
      skill_downloads: skill.downloads,
      app_package: skill.app?.packagePath,
    });
  }, [analytics, skill.id, skill.title, skill.score, skill.downloads, skill.app?.packagePath]);

  return (
    <Card className="group hover-elevate active-elevate-2 transition-all duration-200 overflow-visible">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
            <Smartphone className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold truncate" data-testid={`text-skill-title-${skill.id}`}>
                {skill.title}
              </h3>
              <Badge variant="secondary" className="flex-shrink-0">
                App
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2" data-testid={`text-skill-description-${skill.id}`}>
              {skill.description}
            </p>
            {skill.app && (
              <p className="mt-2 text-xs text-muted-foreground font-mono">
                {skill.app.packagePath}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 text-primary" />
              <span data-testid={`text-skill-score-${skill.id}`}>{skill.score}</span>
            </div>
            <div className="flex items-center gap-1">
              <Download className="h-4 w-4" />
              <span data-testid={`text-skill-downloads-${skill.id}`}>{skill.downloads}</span>
            </div>
          </div>
          <Link
            href={`/skills/${skill.id}`}
            onClick={handleClick}
          >
            <Button variant="ghost" size="sm" className="gap-1" data-testid={`button-view-skill-${skill.id}`}>
              View Details
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
});

export function SkillCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-lg bg-muted animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-2/3 bg-muted animate-pulse rounded" />
            <div className="h-4 w-full bg-muted animate-pulse rounded" />
            <div className="h-4 w-4/5 bg-muted animate-pulse rounded" />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-4">
            <div className="h-4 w-12 bg-muted animate-pulse rounded" />
            <div className="h-4 w-12 bg-muted animate-pulse rounded" />
          </div>
          <div className="h-8 w-24 bg-muted animate-pulse rounded" />
        </div>
      </CardContent>
    </Card>
  );
}
