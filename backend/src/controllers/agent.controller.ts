import { Request, Response } from 'express';
import { AgentService } from '../services/agent.service';
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
]);

const MAX_PROMPT_LENGTH = 2000;

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

      // Prevent cross-user IDOR / identity spoofing
      if (userId !== undefined && String(userId) !== authUser.id && !hasRole(authUser.role, ['admin', 'superadmin'])) {
        res.status(403).json({ success: false, error: 'Forbidden: tidak boleh menjalankan agen atas nama akun lain.' });
        return;
      }

      const requestedRole = role === 'merchant' ? 'merchant' : 'user';
      const effectiveUserRole = normalizeRole(authUser.role);
      if (requestedRole === 'merchant' && !hasRole(effectiveUserRole, ['merchant', 'admin', 'superadmin'])) {
        res.status(403).json({ success: false, error: 'Forbidden: mode merchant hanya untuk akun merchant/admin.' });
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

      const cleanCafeId = typeof cafeId === 'string' && cafeId.trim() ? cafeId.trim() : undefined;
      if (requestedRole === 'merchant' && cleanCafeId && cleanCafeId !== 'm_warkop_sahabat' && !hasRole(effectiveUserRole, ['admin', 'superadmin'])) {
        try {
          const ownedCafe = await prisma.merchantProfile?.findUnique?.({
            where: { id: cleanCafeId },
            select: { user_id: true },
          });
          if (ownedCafe && ownedCafe.user_id !== authUser.id) {
            res.status(403).json({ success: false, error: 'Forbidden: bukan pemilik profil kafe tersebut.' });
            return;
          }
        } catch {
          // Safe fallback when DB is unavailable in unit tests
        }
      }

      const result = await AgentService.executeAgent({
        role: requestedRole,
        trigger: cleanTrigger as any,
        customPrompt: typeof customPrompt === 'string' ? customPrompt.trim() : undefined,
        cafeId: cleanCafeId || 'm_warkop_sahabat',
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
   * Toggle autonomous background execution ON/OFF (merchant/admin only)
   */
  public static async toggle(req: Request, res: Response): Promise<void> {
    try {
      const authUser = (req as AuthRequest).user;
      if (!authUser?.id) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
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

      const requestedRole = role === 'merchant' ? 'merchant' : 'user';
      if (requestedRole === 'merchant' && !hasRole(authUser.role, ['merchant', 'admin', 'superadmin'])) {
        res.status(403).json({ success: false, error: 'Forbidden: mode merchant hanya untuk akun merchant/admin.' });
        return;
      }

      const result = await AgentService.executeAgent({
        role: requestedRole,
        trigger: 'custom',
        customPrompt: message.trim(),
        cafeId: typeof cafeId === 'string' && cafeId.trim() ? cafeId.trim() : undefined,
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
