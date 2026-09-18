"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@droiduse/shared-ui/button";
import { Card, CardContent } from "@droiduse/shared-ui/card";
import { SkillCard, SkillCardSkeleton } from "@/components/skill-card";
import { Package, ArrowRight } from "lucide-react";
import type { SkillWithApp } from "@droiduse/shared-lib";

export default function DashboardSkills() {
  const { data: mySkills, isLoading: loadingSkills } = useQuery<SkillWithApp[]>({
    queryKey: ["/api/skills/mine"],
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Your Contributions</h2>
        <Link href="/marketplace">
          <Button variant="ghost" size="sm" className="gap-1" data-testid="button-view-all-skills">
            View All
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {loadingSkills ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkillCardSkeleton key={i} />
          ))}
        </div>
      ) : mySkills && mySkills.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {mySkills.slice(0, 6).map((skill) => (
            <SkillCard key={skill.id} skill={skill} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-2">No contributions yet</h3>
            <p className="text-muted-foreground mb-4">
              Share your skills with the community
            </p>
            <Link href="/contribute">
              <Button data-testid="button-start-contributing-empty">
                Start Contributing
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
