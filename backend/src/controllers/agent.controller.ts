import { Request, Response } from 'express';
import { AgentService } from '../services/agent.service';
import { MerchantService } from '../services/merchant.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { hasRole, normalizeRole } from '../middleware/rbac.middleware';
import { prisma } from '../utils/prisma';

const ALLOWED_TRIGGERS = new Set([
  'custom',
  'low_traffic',
  'ambience_autopilot',
  'mou_automation',
  'supply_chain_autopilot',
  'user_concierge_mixtape',
  'user_concierge_cafe',
  'user_concierge_points',
]);

const MERCHANT_ONLY_TRIGGERS = new Set([
  'low_traffic',
  'ambience_autopilot',
  'mou_automation',
  'supply_chain_autopilot',
]);

const MAX_PROMPT_LENGTH = 2000;

async function resolveAuthorizedMerchantCafeId(
  authUserId: string,
  effectiveRole: string,
  requestedCafeId?: string
): Promise<{ ok: true; cafeId?: string } | { ok: false; status: number; error: string }> {
  const isAdmin = hasRole(effectiveRole, ['admin', 'superadmin']);

  if (requestedCafeId) {
    const targetCafe = await prisma.merchantProfile.findUnique({
      where: { id: requestedCafeId },
      select: {
        id: true,
        user_id: true,
        is_showcase: true,
        is_verified: true,
        review_status: true,
        deleted_at: true,
      },
    });

    if (!targetCafe || targetCafe.deleted_at) {
      return { ok: false, status: 404, error: 'Profil kafe tidak ditemukan.' };
    }
    if (targetCafe.is_showcase) {
      return { ok: false, status: 403, error: 'Forbidden: profil showcase read-only tidak dapat dijalankan dalam mode merchant.' };
    }
    if (!isAdmin && targetCafe.user_id !== authUserId) {
      return { ok: false, status: 403, error: 'Forbidden: bukan pemilik profil kafe tersebut.' };
    }
    if (!MerchantService.isApprovedMerchantProfile(targetCafe)) {
      return { ok: false, status: 403, error: 'Forbidden: profil merchant belum disetujui.' };
    }

    return { ok: true, cafeId: targetCafe.id };
  }

  if (isAdmin) {
    const ownProfile = await prisma.merchantProfile.findUnique({
      where: { user_id: authUserId },
      select: {
        id: true,
        is_showcase: true,
        is_verified: true,
        review_status: true,
        deleted_at: true,
      },
    });
    if (ownProfile && !ownProfile.deleted_at && !ownProfile.is_showcase && MerchantService.isApprovedMerchantProfile(ownProfile)) {
      return { ok: true, cafeId: ownProfile.id };
    }
    return { ok: true, cafeId: undefined };
  }

  const ownedProfile = await prisma.merchantProfile.findUnique({
    where: { user_id: authUserId },
    select: {
      id: true,
      user_id: true,
      is_showcase: true,
      is_verified: true,
      review_status: true,
      deleted_at: true,
    },
  });

  if (!ownedProfile || ownedProfile.deleted_at || ownedProfile.is_showcase || !MerchantService.isApprovedMerchantProfile(ownedProfile)) {
    return { ok: false, status: 403, error: 'Forbidden: profil merchant terverifikasi tidak ditemukan.' };
  }

  return { ok: true, cafeId: ownedProfile.id };
}

export class AgentController {
  /**
   * POST /api/ai/agent/execute
   * Execute an autonomous trigger or ReAct task (authenticated)
   */
  public static async execute(req: Request, res: Response): Promise<void> {
    try {
      const authUser = (req as AuthRequest).user;
      if (!authUser?.id) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { role, trigger, customPrompt, cafeId, userId } = req.body || {};
      const effectiveUserRole = normalizeRole(authUser.role);

      // Prevent cross-user IDOR / identity spoofing
      if (userId !== undefined && String(userId) !== authUser.id && !hasRole(effectiveUserRole, ['admin', 'superadmin'])) {
        res.status(403).json({ success: false, error: 'Forbidden: tidak boleh menjalankan agen atas nama akun lain.' });
        return;
      }

      const cleanTrigger = typeof trigger === 'string' && trigger.trim() ? trigger.trim() : 'custom';
      if (!ALLOWED_TRIGGERS.has(cleanTrigger)) {
        res.status(400).json({ success: false, error: 'Trigger agen tidak valid.' });
        return;
      }

      if (customPrompt !== undefined && (typeof customPrompt !== 'string' || customPrompt.length > MAX_PROMPT_LENGTH)) {
        res.status(400).json({ success: false, error: `Prompt maksimal ${MAX_PROMPT_LENGTH} karakter.` });
        return;
      }

      const wantsMerchantMode = role === 'merchant' || (role !== 'user' && MERCHANT_ONLY_TRIGGERS.has(cleanTrigger));
      if (role === 'user' && MERCHANT_ONLY_TRIGGERS.has(cleanTrigger)) {
        res.status(403).json({ success: false, error: 'Forbidden: trigger merchant tidak diizinkan pada mode user.' });
        return;
      }

      const requestedRole: 'merchant' | 'user' = wantsMerchantMode ? 'merchant' : 'user';
      if (requestedRole === 'merchant' && !hasRole(effectiveUserRole, ['merchant', 'admin', 'superadmin'])) {
        res.status(403).json({ success: false, error: 'Forbidden: mode merchant hanya untuk akun merchant/admin.' });
        return;
      }

      const cleanCafeId = typeof cafeId === 'string' && cafeId.trim() ? cafeId.trim() : undefined;
      let resolvedCafeId: string | undefined;

      if (requestedRole === 'merchant') {
        const cafeCheck = await resolveAuthorizedMerchantCafeId(authUser.id, effectiveUserRole, cleanCafeId);
        if (!cafeCheck.ok) {
          res.status(cafeCheck.status).json({ success: false, error: cafeCheck.error });
          return;
        }
        resolvedCafeId = cafeCheck.cafeId;
      }

      const result = await AgentService.executeAgent({
        role: requestedRole,
        trigger: cleanTrigger as any,
        customPrompt: typeof customPrompt === 'string' ? customPrompt.trim() : undefined,
        cafeId: resolvedCafeId,
        userId: authUser.id,
      });

      res.status(200).json(result);
    } catch (err: any) {
      console.error('[AgentController.execute] Error:', err?.message || 'Execution error');
      res.status(500).json({
        success: false,
        error: 'Gagal mengeksekusi agen otonom ngopAI.',
      });
    }
  }

  /**
   * GET /api/ai/agent/status
   * Get autonomous loop status (merchant/admin only)
   */
  public static async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const authUser = (req as AuthRequest).user;
      if (!authUser?.id) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }
      if (!hasRole(authUser.role, ['merchant', 'admin', 'superadmin'])) {
        res.status(403).json({ success: false, error: 'Forbidden: status agen hanya untuk akun merchant/admin.' });
        return;
      }
      const status = AgentService.getStatus();
      res.status(200).json({ success: true, ...status });
    } catch (err: any) {
      console.error('[AgentController.getStatus] Error:', err?.message || 'Status error');
      res.status(500).json({ success: false, error: 'Gagal mengambil status agen.' });
    }
  }

  /**
   * POST /api/ai/agent/toggle
   * Toggle global autonomous background execution ON/OFF (admin/superadmin only)
   */
  public static async toggle(req: Request, res: Response): Promise<void> {
    try {
      const authUser = (req as AuthRequest).user;
      if (!authUser?.id) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }
      if (!hasRole(authUser.role, ['admin', 'superadmin'])) {
        res.status(403).json({ success: false, error: 'Forbidden: pengaturan global agen hanya untuk admin atau superadmin.' });
        return;
      }
      const { enabled } = req.body || {};
      if (typeof enabled !== 'boolean') {
        res.status(400).json({ success: false, error: 'Parameter enabled harus berupa boolean.' });
        return;
      }
      const status = AgentService.toggleAutonomousMode(enabled);
      res.status(200).json({ success: true, ...status });
    } catch (err: any) {
      console.error('[AgentController.toggle] Error:', err?.message || 'Toggle error');
      res.status(500).json({ success: false, error: 'Gagal mengubah status mode otonom.' });
    }
  }

  /**
   * POST /api/ai/agent/chat
   * Chat conversation with barista / virtual manager persona (authenticated)
   */
  public static async chat(req: Request, res: Response): Promise<void> {
    try {
      const authUser = (req as AuthRequest).user;
      if (!authUser?.id) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { message, role, cafeId } = req.body || {};
      if (typeof message !== 'string' || !message.trim()) {
        res.status(400).json({ success: false, error: 'Pesan tidak boleh kosong.' });
        return;
      }
      if (message.length > MAX_PROMPT_LENGTH) {
        res.status(400).json({ success: false, error: `Pesan maksimal ${MAX_PROMPT_LENGTH} karakter.` });
        return;
      }

      const effectiveUserRole = normalizeRole(authUser.role);
      const requestedRole = role === 'merchant' ? 'merchant' : 'user';
      if (requestedRole === 'merchant' && !hasRole(effectiveUserRole, ['merchant', 'admin', 'superadmin'])) {
        res.status(403).json({ success: false, error: 'Forbidden: mode merchant hanya untuk akun merchant/admin.' });
        return;
      }

      const cleanCafeId = typeof cafeId === 'string' && cafeId.trim() ? cafeId.trim() : undefined;
      let resolvedCafeId: string | undefined;

      if (requestedRole === 'merchant') {
        const cafeCheck = await resolveAuthorizedMerchantCafeId(authUser.id, effectiveUserRole, cleanCafeId);
        if (!cafeCheck.ok) {
          res.status(cafeCheck.status).json({ success: false, error: cafeCheck.error });
          return;
        }
        resolvedCafeId = cafeCheck.cafeId;
      }

      const result = await AgentService.executeAgent({
        role: requestedRole,
        trigger: 'custom',
        customPrompt: message.trim(),
        cafeId: resolvedCafeId,
        userId: authUser.id,
      });

      res.status(200).json({
        success: true,
        reply: result.summary,
        steps: result.steps,
        artifacts: result.createdArtifacts,
      });
    } catch (err: any) {
      console.error('[AgentController.chat] Error:', err?.message || 'Chat error');
      res.status(500).json({ success: false, error: 'Gagal memproses percakapan ngopAI.' });
    }
  }
}
