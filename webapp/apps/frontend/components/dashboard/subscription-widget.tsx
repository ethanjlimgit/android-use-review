'use client';

import { Button } from '@droiduse/shared-ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@droiduse/shared-ui/card';
import { Progress } from '@droiduse/shared-ui/progress';
import { Badge } from '@droiduse/shared-ui/badge';
import { CreditCard, TrendingUp, AlertCircle, Gift } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useSubscription } from '@/hooks/use-subscription';

export function SubscriptionWidget() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { subscription, isLoading, totalAvailable, totalCredits, isNearCreditLimit } = useSubscription();

  const handleManageSubscription = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
      });
      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error('Error opening customer portal:', error);
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-8 bg-muted rounded w-1/2" />
            <div className="h-2 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!subscription) return null;

  const freeBonusCredits = subscription.freeBonusCredits || 0;
  const usagePercent = totalCredits > 0
    ? ((totalCredits - totalAvailable) / totalCredits) * 100
    : 0;

  const isFree = subscription.tier === 'free';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Subscription
          </CardTitle>
          <Badge variant={subscription.status === 'active' ? 'default' : 'secondary'}>
            {subscription.tier.toUpperCase()}
          </Badge>
        </div>
        <CardDescription>
          {isFree ? 'Upgrade to unlock more features' : 'Manage your subscription'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Credits Available */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Credits Available</span>
            <span className="font-medium">
              {totalAvailable.toLocaleString()} / {totalCredits.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Progress value={usagePercent} className={`h-2 flex-1 ${isNearCreditLimit ? "[&>div]:bg-orange-500" : ""}`} />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {Math.round(usagePercent)}% used
            </span>
          </div>
        </div>

        {/* Bonus Credits */}
        {freeBonusCredits > 0 && (
          <div className="flex items-center justify-between text-sm rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2">
            <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
              <Gift className="h-3.5 w-3.5" />
              Bonus Credits (used first)
            </span>
            <span className="font-medium text-green-600 dark:text-green-400">
              {freeBonusCredits.toLocaleString()}
            </span>
          </div>
        )}

        {isNearCreditLimit && (
          <div className="flex items-start gap-2 rounded-lg border border-orange-500 bg-orange-500/10 p-3">
            <AlertCircle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-orange-600 dark:text-orange-400">
              You are running low on credits. {isFree ? "Upgrade to get more credits." : "Consider upgrading your plan."}
            </p>
          </div>
        )}

        {subscription.creditResetDate && (
          <p className="text-xs text-muted-foreground">
            Plan credits reset on {new Date(subscription.creditResetDate).toLocaleDateString()}
          </p>
        )}
      </CardContent>

      <CardFooter className="flex gap-2">
        {isFree ? (
          <Button
            className="w-full gap-2"
            onClick={() => router.push('/pricing')}
          >
            <TrendingUp className="h-4 w-4" />
            Upgrade Plan
          </Button>
        ) : (
          <Button
            variant="outline"
            className="w-full"
            onClick={handleManageSubscription}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Manage Subscription'}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
