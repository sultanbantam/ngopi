import { Request, Response } from 'express';
import { AgentService } from '../services/agent.service';

export class AgentController {
  /**
   * POST /api/ai/agent/execute
   * Execute an autonomous trigger or ReAct task (One-Click Demo or Custom Prompt)
   */
  public static async execute(req: Request, res: Response): Promise<void> {
    try {
      const { role, trigger, customPrompt, cafeId, userId } = req.body || {};

      const result = await AgentService.executeAgent({
        role: role === 'user' ? 'user' : 'merchant',
        trigger: trigger || 'custom',
        customPrompt,
        cafeId: cafeId || 'm_warkop_sahabat',
        userId: userId || (req as any).user?.id,
      });

      res.status(200).json(result);
    } catch (err: any) {
      console.error('[AgentController.execute] Error:', err);
      res.status(500).json({
        success: false,
        error: err?.message || 'Gagal mengeksekusi agen otonom ngopAI.',
      });
    }
  }

  /**
   * GET /api/ai/agent/status
   * Get autonomous loop status, background intervention count, and logs
   */
  public static async getStatus(_req: Request, res: Response): Promise<void> {
    try {
      const status = AgentService.getStatus();
      res.status(200).json({ success: true, ...status });
    } catch (err: any) {
      console.error('[AgentController.getStatus] Error:', err);
      res.status(500).json({ success: false, error: 'Gagal mengambil status agen.' });
    }
  }

  /**
   * POST /api/ai/agent/toggle
   * Toggle autonomous background execution ON/OFF
   */
  public static async toggle(req: Request, res: Response): Promise<void> {
    try {
      const { enabled } = req.body || {};
      const status = AgentService.toggleAutonomousMode(enabled);
      res.status(200).json({ success: true, ...status });
    } catch (err: any) {
      console.error('[AgentController.toggle] Error:', err);
      res.status(500).json({ success: false, error: 'Gagal mengubah status mode otonom.' });
    }
  }

  /**
   * POST /api/ai/agent/chat
   * Chat conversation with barista / virtual manager persona
   */
  public static async chat(req: Request, res: Response): Promise<void> {
    try {
      const { message, role, cafeId } = req.body || {};
      if (!message || !message.trim()) {
        res.status(400).json({ success: false, error: 'Pesan tidak boleh kosong.' });
        return;
      }

      const result = await AgentService.executeAgent({
        role: role === 'user' ? 'user' : 'merchant',
        trigger: 'custom',
        customPrompt: message,
        cafeId,
        userId: (req as any).user?.id,
      });

      res.status(200).json({
        success: true,
        reply: result.summary,
        steps: result.steps,
        artifacts: result.createdArtifacts,
      });
    } catch (err: any) {
      console.error('[AgentController.chat] Error:', err);
      res.status(500).json({ success: false, error: 'Gagal memproses percakapan ngopAI.' });
    }
  }
}
