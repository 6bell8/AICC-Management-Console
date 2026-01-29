import { z } from "zod";

export const campaignStatusSchema = z.enum([
    "DRAFT",
    "RUNNING",
    "PAUSED",
    "ARCHIVED",
]);

export const campaignSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable().optional(),
    status: campaignStatusSchema,
    startAt: z.string().nullable().optional(),
    endAt: z.string().nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
});

export const campaignUpdateSchema = z.object({
    name: z.string().min(1, "캠페인 이름은 필수입니다."),
    description: z.string().nullable().optional(),
    status: campaignStatusSchema,
    startAt: z.string().nullable().optional(),
    endAt: z.string().nullable().optional(),
});

export type CampaignUpdateFormValues = z.infer<typeof campaignUpdateSchema>;
