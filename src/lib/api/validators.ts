import { z } from "zod";

export const createClientSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(["INDIVIDUAL", "BUSINESS"]),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  pan: z.string().max(10).optional().nullable(),
  gstin: z.string().max(15).optional().nullable(),
  tan: z.string().max(10).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE", "ONBOARDING"]).default("ACTIVE"),
  assignedToIds: z.array(z.string().cuid()).optional(),
});

export const updateClientSchema = createClientSchema.partial().extend({
  isPinned: z.boolean().optional(),
});

export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().max(2000).optional().nullable(),
  assignedToId: z.string().cuid("Invalid assignee ID"),
  clientId: z.string().cuid("Invalid client ID").optional().nullable(),
  complianceItemId: z.string().cuid("Invalid compliance item ID").optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
});

export const updateTaskSchema = z.object({
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "REVIEW", "DONE"]).optional(),
  assignedToId: z.string().cuid().optional().nullable(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  clientId: z.string().cuid().optional().nullable(),
  complianceItemId: z.string().cuid().optional().nullable(),
});

export const createInvoiceSchema = z.object({
  clientId: z.string().cuid("Invalid client ID"),
  serviceSubscriptionId: z.string().cuid().optional().nullable(),
  dueDate: z.string().datetime(),
  notes: z.string().max(1000).optional().nullable(),
  lineItems: z.array(
    z.object({
      description: z.string().min(1).max(255),
      quantity: z.number().int().positive().default(1),
      unitPrice: z.number().nonnegative(),
      taxRate: z.number().nonnegative().max(100).default(0),
    })
  ).min(1, "At least one line item required"),
});

export const updateInvoiceSchema = z.object({
  status: z.enum(["DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE", "VOID"]).optional(),
  dueDate: z.string().datetime().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const createCommentSchema = z.object({
  content: z.string().min(1, "Content is required").max(5000),
  parentType: z.enum(["task", "client", "document", "complianceItem", "invoice"]),
  parentId: z.string().cuid("Invalid parent ID"),
  mentions: z.array(z.string().cuid()).optional(),
});

export const updateCommentSchema = z.object({
  content: z.string().min(1).max(5000),
});

export const createComplianceItemSchema = z.object({
  clientId: z.string().cuid("Invalid client ID"),
  type: z.enum(["GST", "INCOME_TAX", "SALES_TAX_VAT", "TDS", "ROC"]),
  dueDate: z.string().datetime(),
  notes: z.string().max(1000).optional().nullable(),
  manualOverride: z.boolean().default(true),
});

export const updateComplianceItemSchema = z.object({
  status: z.enum(["PENDING", "IN_PROGRESS", "FILED", "ACKNOWLEDGED"]).optional(),
  filedDate: z.string().datetime().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  manualOverride: z.boolean().optional(),
});

export const createServiceSubscriptionSchema = z.object({
  clientId: z.string().cuid("Invalid client ID"),
  serviceId: z.string().cuid("Invalid service ID"),
  startDate: z.string().datetime().optional(),
  filingFrequency: z.string().optional().nullable(),
});

const nullToUndefined = (val: unknown) =>
  val === null || val === undefined || val === "" ? undefined : val;

export const paginationSchema = z.object({
  page: z.preprocess(nullToUndefined, z.coerce.number().int().positive().default(1)),
  pageSize: z.preprocess(nullToUndefined, z.coerce.number().int().positive().max(100).default(50)),
});

export const taskFiltersSchema = paginationSchema.extend({
  clientId: z.preprocess(nullToUndefined, z.string().cuid().optional()),
  status: z.preprocess(nullToUndefined, z.enum(["NOT_STARTED", "IN_PROGRESS", "REVIEW", "DONE"]).optional()),
});

export const invoiceFiltersSchema = paginationSchema.extend({
  clientId: z.preprocess(nullToUndefined, z.string().cuid().optional()),
  status: z.preprocess(nullToUndefined, z.enum(["DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE", "VOID"]).optional()),
});

export const clientFiltersSchema = paginationSchema.extend({
  status: z.preprocess(nullToUndefined, z.enum(["ACTIVE", "INACTIVE", "ONBOARDING"]).optional()),
  search: z.preprocess(nullToUndefined, z.string().optional()),
  type: z.preprocess(nullToUndefined, z.enum(["INDIVIDUAL", "BUSINESS"]).optional()),
});

export const commentFiltersSchema = paginationSchema.extend({
  parentType: z.preprocess(nullToUndefined, z.enum(["task", "client", "document", "complianceItem", "invoice"]).optional()),
  parentId: z.preprocess(nullToUndefined, z.string().cuid().optional()),
});

export const registerClientSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  type: z.enum(["INDIVIDUAL", "BUSINESS"]).optional(),
  pan: z.string().max(10).optional().nullable(),
  gstin: z.string().max(15).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
});

export const registerStaffSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1).max(100),
  password: z.string().min(8).max(100),
});

export const inviteStaffSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "MANAGER", "ACCOUNTANT", "DATA_ENTRY"]),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.enum(["ADMIN", "MANAGER", "ACCOUNTANT", "DATA_ENTRY", "CLIENT"]).optional(),
  isActive: z.boolean().optional(),
  clientId: z.string().cuid().optional().nullable(),
});

export const userFiltersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(50),
  role: z.enum(["ADMIN", "MANAGER", "ACCOUNTANT", "DATA_ENTRY", "CLIENT"]).optional(),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

export function validateBody<T>(body: unknown, schema: z.ZodSchema<T>): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const message = Object.entries(errors)
      .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(", ")}`)
      .join("; ");
    throw new ValidationError(message);
  }
  return result.data;
}