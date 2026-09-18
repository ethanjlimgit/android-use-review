import { z } from "zod";

export const insertUserSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export const insertAppSchema = z.object({
  packagePath: z.string(),
  name: z.string(),
  version: z.string(),
  iconUrl: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
});

export const insertSkillSchema = z.object({
  title: z.string(),
  description: z.string(),
  appId: z.string(),
  authorId: z.string().nullable().optional(),
  score: z.number().optional(),
  downloads: z.number().optional(),
  featured: z.boolean().optional(),
});

export const insertDeviceSchema = z.object({
  userId: z.string().nullable().optional(),
  name: z.string(),
  deviceId: z.string(),
  deviceTypeId: z.string(),
  osVersion: z.string().nullable().optional(),
  status: z.string().optional(),
  fcmToken: z.string().nullable().optional(),
});

export const updateDeviceSchema = insertDeviceSchema.partial();

export const deviceInfoSchema = z.object({
  deviceId: z.string().uuid(),
  name: z.string(),
  manufacturer: z.string(),
  model: z.string(),
  osVersion: z.string(),
  apiLevel: z.number().int().optional(),
  displayMetrics: z.object({
    widthPixels: z.number().int(),
    heightPixels: z.number().int(),
    density: z.number(),
    densityDpi: z.number().int(),
    scaledDensity: z.number().optional(),
  }),
  screenRefreshRate: z.number().optional(),
});

export type DeviceInfo = z.infer<typeof deviceInfoSchema>;

export const insertBlogPostSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  excerpt: z.string().nullable().optional(),
  content: z.string().min(1), // Markdown content
  authorId: z.string(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  featured: z.boolean().default(false),
  featuredImage: z.string().url().nullable().optional(),
  seoTitle: z.string().nullable().optional(),
  seoDescription: z.string().nullable().optional(),
  seoKeywords: z.string().nullable().optional(),
  publishedAt: z.coerce.date().nullable().optional(),
});

export const updateBlogPostSchema = insertBlogPostSchema.partial().extend({
  id: z.string(),
});

export const insertTaskSchema = z.object({
  deviceId: z.string(),
  goal: z.string().min(5),
  userId: z.string().nullable().optional(),
  runType: z.string().nullable().optional(),
  isReasoning: z.boolean().optional(),
  isReplay: z.boolean().optional(),
  replaySourceId: z.string().nullable().optional(),
});

export const updateTaskSchema = z.object({
  runType: z.string().nullable().optional(),
  isReasoning: z.boolean().optional(),
  status: z.enum(['RUNNING', 'COMPLETED', 'FAILED', 'TIMED_OUT']).optional(),
  totalSteps: z.number().int().min(0).optional(),
  error: z.string().nullable().optional(),
  response: z.string().nullable().optional(),
  profilingSummary: z.record(z.string(), z.any()).optional(),
  completedAt: z.coerce.date().nullable().optional(),
  archivedAt: z.coerce.date().nullable().optional(),
  isReplay: z.boolean().optional(),
  replaySourceId: z.string().nullable().optional(),
});

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const insertTaskStepSchema = z.object({
  taskId: z.string(),
  stepNumber: z.number().int().min(0),
  agentType: z.string(),
  actions: z.array(z.any()).nullable().optional(),
  thought: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  subgoal: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  status: z.enum(['SUCCESS', 'FAILED']).default('SUCCESS'),
  error: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  fullResponse: z.string().nullable().optional(),
  a11yTree: z.any().nullable().optional(),
  phoneState: z.any().nullable().optional(),
  formattedText: z.string().nullable().optional(),
  startedAt: z.coerce.date().nullable().optional(),
  completedAt: z.coerce.date().nullable().optional(),
});

export const updateTaskStepSchema = z.object({
  actions: z.array(z.any()).nullable().optional(),
  status: z.enum(['SUCCESS', 'FAILED']).optional(),
  error: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  fullResponse: z.string().nullable().optional(),
  a11yTree: z.any().nullable().optional(),
  phoneState: z.any().nullable().optional(),
  formattedText: z.string().nullable().optional(),
  startedAt: z.coerce.date().nullable().optional(),
  completedAt: z.coerce.date().nullable().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const updateUserProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50, 'Name is too long'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// Stripe schemas
export const createCheckoutSessionSchema = z.object({
  tier: z.enum(['basic', 'premium', 'business']),
  billingPeriod: z.enum(['monthly', 'yearly']),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  countryCode: z.string().length(2).optional(), // ISO 3166-1 alpha-2 country code for regional pricing
});

export type CreateCheckoutSessionInput = z.infer<typeof createCheckoutSessionSchema>;

// Payment Intent response type (for native mobile apps)
export type PaymentIntentResponse = {
  success: boolean;
  clientSecret?: string; // Client secret for PaymentIntent or SetupIntent
  customer?: string; // Stripe customer ID
  subscriptionId?: string; // Subscription ID to track in your database
  publishableKey?: string; // Stripe publishable key for mobile SDK
  error?: string | null;
};

// Survey validation schemas
export const userTypeSelectionSchema = z.object({
  userType: z.enum(['individual', 'company']),
});

export const companySizeSchema = z.object({
  companySize: z.enum(['just_me', '2-10', '11-50', '51-200', '201-1000', '1000+']),
});

export const industrySchema = z.object({
  industry: z.string().min(1, 'Please select an industry'),
});

export const occupationSchema = z.object({
  occupation: z.string().min(2, 'Please enter your job title/occupation').max(100, 'Occupation is too long'),
});

export const useCaseSchema = z.object({
  useCase: z.string()
    .min(10, 'Please provide at least 10 characters')
    .max(500, 'Please keep your answer under 500 characters'),
});

export const completeSurveySchema = z.object({
  userType: z.enum(['individual', 'company']),
  companySize: z.string().optional(),
  industry: z.string(),
  occupation: z.string(),
  useCase: z.string().min(10).max(500),
});

export type CompleteSurveyInput = z.infer<typeof completeSurveySchema>;

