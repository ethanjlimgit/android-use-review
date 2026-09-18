import { Card, CardContent } from "@droiduse/shared-ui/card";
import { Button } from "@droiduse/shared-ui/button";
import { Smartphone, ExternalLink } from "lucide-react";

export default function DashboardDemoRequest() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Card className="w-full max-w-lg mx-4">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Smartphone className="h-8 w-8 text-primary" />
          </div>

          <h2 className="text-2xl font-bold tracking-tight">
            Request a Demo
          </h2>

          <p className="mt-3 text-muted-foreground max-w-sm mx-auto">
            Get a personalized walkthrough of AndroidUse and see how AI-powered
            device automation can work for you.
          </p>

          <a
            href="https://calendar.app.google/XjhYUYztW1wv49z67"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="lg" className="mt-6 gap-2">
              Request Demo
              <ExternalLink className="h-4 w-4" />
            </Button>
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
