import Joi from 'joi';

const safeText = (max = 500) => Joi.string().trim().max(max);
export const uuidSchema = Joi.string().guid({ version: ['uuidv4', 'uuidv5'] });
export const roomIdSchema = Joi.string().trim().min(1).max(220).pattern(/^[A-Za-z0-9_.:@-]+$/);
export const usernameSchema = Joi.string().trim().lowercase().min(3).max(30).pattern(/^[a-z0-9_.-]+$/);
export const roleSchema = Joi.string().valid('user', 'agent_cs', 'admin', 'superadmin', 'agent');

export const registerSchema = Joi.object({
  username: usernameSchema.required(),
  password: Joi.string().min(8).max(128).required(),
  display_name: safeText(50).required(),
  wallet_address: Joi.string().trim().max(120).allow(null, ''),
  public_key: Joi.string().trim().max(2048).required(),
});

export const loginSchema = Joi.object({
  username: usernameSchema.required(),
  password: Joi.string().min(1).max(128).required(),
  mfa_code: Joi.string().trim().pattern(/^\d{6}$/).optional(),
});

export const refreshTokenSchema = Joi.object({
  refresh_token: Joi.string().trim().max(512).optional(),
});

export const mfaCodeSchema = Joi.object({
  code: Joi.string().trim().pattern(/^\d{6}$/).required(),
});

export const mfaLoginSchema = Joi.object({
  challenge_token: Joi.string().trim().max(2048).optional(),
  code: Joi.string().trim().pattern(/^\d{6}$/).required(),
});

export const profileUpdateSchema = Joi.object({
  display_name: safeText(50).optional(),
  wallet_address: Joi.string().trim().max(120).allow(null, '').optional(),
  avatar_url: Joi.string().uri({ scheme: ['http', 'https'] }).max(1024).allow(null, '').optional(),
  bio: safeText(500).allow(null, '').optional(),
  status: safeText(120).allow(null, '').optional(),
}).min(1);

export const roomParamsSchema = Joi.object({
  room_id: roomIdSchema.required(),
});

export const idParamsSchema = Joi.object({
  id: uuidSchema.required(),
});

export const userIdParamsSchema = Joi.object({
  id: uuidSchema.required(),
  userId: uuidSchema.required(),
});

export const inviteCodeParamsSchema = Joi.object({
  code: Joi.string().trim().min(6).max(32).pattern(/^[A-Za-z0-9_-]+$/).required(),
});

export const createGroupSchema = Joi.object({
  name: safeText(80).required(),
  description: safeText(500).allow(null, '').optional(),
  avatarUrl: Joi.string().uri({ scheme: ['http', 'https'] }).max(1024).allow(null, '').optional(),
  minBmcBalance: Joi.number().min(0).max(1000000000).optional(),
  joinPolicy: Joi.string().valid('open', 'approval').optional(),
  onlyAdminsCanSend: Joi.boolean().optional(),
  allowMemberInvites: Joi.boolean().optional(),
  callEnabled: Joi.boolean().optional(),
  memberIds: Joi.array().items(Joi.string().uuid()).unique().max(100).optional(),
});

export const updateGroupSchema = createGroupSchema;

export const addGroupMemberSchema = Joi.object({
  userId: uuidSchema.required(),
  role: Joi.string().valid('member', 'admin').optional(),
});

export const updateGroupMemberRoleSchema = Joi.object({
  role: Joi.string().valid('member', 'admin').required(),
});

export const createTicketSchema = Joi.object({
  platform_id: uuidSchema.required(),
  title: safeText(160).required(),
  message: safeText(5000).required(),
  is_escalated: Joi.boolean().optional(),
});

export const ticketMessageSchema = Joi.object({
  content: safeText(5000).required(),
  is_internal: Joi.boolean().optional(),
});

export const ticketStatusSchema = Joi.object({
  status: Joi.string().valid('open', 'in_progress', 'resolved', 'closed').required(),
});

export const assignTicketSchema = Joi.object({
  agent_id: uuidSchema.optional(),
});

export const adminTicketQuerySchema = Joi.object({
  status: Joi.string().valid('open', 'in_progress', 'resolved', 'closed').optional(),
  platform_id: uuidSchema.optional(),
});

export const faqUpsertSchema = Joi.object({
  platform_id: uuidSchema.required(),
  question: safeText(500).required(),
  answer: safeText(5000).required(),
  keywords: Joi.array().items(safeText(80)).max(30).optional(),
});

export const faqQuerySchema = Joi.object({
  platform_id: uuidSchema.optional(),
  platform: Joi.string().trim().max(80).pattern(/^[A-Za-z0-9_.-]+$/).optional(),
});

export const aiQuerySchema = Joi.object({
  question: safeText(2000).required(),
  platform_id: uuidSchema.allow(null, '').optional(),
});

export const settingsSchema = Joi.object({
  hide_name: Joi.boolean().optional(),
  hide_contacts: Joi.boolean().optional(),
  hide_groups: Joi.boolean().optional(),
  preferred_language: Joi.string().trim().max(12).pattern(/^[a-z]{2}(-[A-Z]{2})?$/).optional(),
}).min(1);

export const walletParamsSchema = Joi.object({
  wallet_address: Joi.string().trim().min(20).max(120).pattern(/^[A-Za-z0-9:_-]+$/).required(),
});