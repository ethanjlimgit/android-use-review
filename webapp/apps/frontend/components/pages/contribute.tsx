"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useAnalytics } from "@/providers/analytics-provider";
import { useSettings } from "@/providers/settings-provider";
import { Button } from "@droiduse/shared-ui/button";
import { Input } from "@droiduse/shared-ui/input";
import { Textarea } from "@droiduse/shared-ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@droiduse/shared-ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@droiduse/shared-ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@droiduse/shared-ui/select";
import { useToast } from "@droiduse/shared-ui/use-toast";
import { apiRequest, queryClient } from "@droiduse/shared-lib";
import {
  Smartphone,
  ChevronRight,
  ChevronLeft,
  Check,
  FileText,
  Eye,
} from "lucide-react";
import type { App } from "@droiduse/shared-lib";

const formSchema = z.object({
  appId: z.string().min(1, "Please select an app"),
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  content: z.string().min(20, "Content must be at least 20 characters"),
});

type FormValues = z.infer<typeof formSchema>;

const steps = [
  { id: "details", title: "Skill Details", icon: FileText },
  { id: "review", title: "Review & Submit", icon: Eye },
];

export default function Contribute() {
  const analytics = useAnalytics()
  const { toast } = useToast();
  const { getSetting } = useSettings();
  const siteName = getSetting("site.name");
  const [currentStep, setCurrentStep] = useState(0);

  const { data: apps } = useQuery<App[]>({
    queryKey: ["/api/apps"],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      appId: "",
      title: "",
      description: "",
      content: "",
    },
  });

  const createSkillMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return apiRequest("POST", "/api/skills", {
        title: data.title,
        description: data.description,
        appId: data.appId,
        score: 0,
        downloads: 0,
        featured: false,
      });
    },
    onSuccess: (_, variables) => {
      analytics.capture("skill_submitted", {
        title: variables.title,
        app_id: variables.appId,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/skills"] });
      queryClient.invalidateQueries({ queryKey: ["/api/skills/mine"] });
      toast({
        title: "Skill submitted",
        description: "Your skill entry has been submitted for review.",
      });
      form.reset();
      setCurrentStep(0);
    },
    onError: (error) => {
      analytics.captureException(error);
      toast({
        title: "Error",
        description: "Failed to submit skill. Please try again.",
        variant: "destructive",
      });
    },
  });

  const watchValues = form.watch();

  const nextStep = async () => {
    if (currentStep === 0) {
      const valid = await form.trigger(["appId", "title", "description", "content"]);
      if (valid) setCurrentStep(1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const onSubmit = (data: FormValues) => {
    // Only submit if we're on the final step (review step)
    if (currentStep === steps.length - 1) {
      createSkillMutation.mutate(data);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Only allow form submission on the final step
    if (currentStep === steps.length - 1) {
      form.handleSubmit(onSubmit)(e);
    } else {
      // If not on final step, trigger next step instead
      nextStep();
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Contribute Skill</h1>
          <p className="mt-2 text-muted-foreground">
            Share your automation skills with the community
          </p>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                      index <= currentStep
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground"
                    }`}
                  >
                    {index < currentStep ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <step.icon className="h-5 w-5" />
                    )}
                  </div>
                  <span className={`mt-2 text-xs font-medium ${
                    index <= currentStep ? "text-foreground" : "text-muted-foreground"
                  }`}>
                    {step.title}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`h-px w-16 sm:w-24 mx-2 ${
                    index < currentStep ? "bg-primary" : "bg-border"
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={handleFormSubmit}>
            {currentStep === 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Skill Details</CardTitle>
                  <CardDescription>
                    Provide detailed information about your app skill entry
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="appId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target App</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-app">
                              <SelectValue placeholder="Select an app" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {apps?.map((app) => (
                              <SelectItem key={app.id} value={app.id}>
                                {app.name} ({app.packagePath})
                              </SelectItem>
                            ))}
                            <SelectItem value="other">Other (specify in description)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Select the Android app this skill applies to
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Navigate to Settings Menu"
                            {...field}
                            data-testid="input-title"
                          />
                        </FormControl>
                        <FormDescription>
                          A clear, concise title for your skill entry
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe what this skill does and when to use it..."
                            className="min-h-[100px]"
                            {...field}
                            data-testid="input-description"
                          />
                        </FormControl>
                        <FormDescription>
                          A brief summary visible in marketplace listings
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Skill Content</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Detailed instructions, action sequences, or implementation details..."
                            className="min-h-[200px] font-mono text-sm"
                            {...field}
                            data-testid="input-content"
                          />
                        </FormControl>
                        <FormDescription>
                          The full skill content with detailed instructions
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            )}

            {currentStep === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Review Your Submission</CardTitle>
                  <CardDescription>
                    Please review your skill entry before submitting
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="rounded-lg border border-border p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Smartphone className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold" data-testid="text-review-title">{watchValues.title || "Untitled"}</p>
                        <p className="text-sm text-muted-foreground">
                          App Skill
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Description</p>
                      <p className="text-sm" data-testid="text-review-description">{watchValues.description || "No description"}</p>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Content Preview</p>
                      <div className="rounded bg-muted p-3 font-mono text-xs max-h-32 overflow-auto" data-testid="text-review-content">
                        {watchValues.content || "No content"}
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground text-center">
                    By submitting, you agree to share this skill with the {siteName} community.
                  </p>
                </CardContent>
              </Card>
            )}

            <div className="flex items-center justify-between mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 0}
                className="gap-2"
                data-testid="button-prev-step"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>

              {currentStep < steps.length - 1 ? (
                <Button type="button" onClick={nextStep} className="gap-2" data-testid="button-next-step">
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={createSkillMutation.isPending}
                  className="gap-2"
                  data-testid="button-submit-skill"
                >
                  {createSkillMutation.isPending ? "Submitting..." : "Submit Skill"}
                  <Check className="h-4 w-4" />
                </Button>
              )}
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
