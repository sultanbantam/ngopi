import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { CreateEventDTO, GameEvent, GameEventInvitation, InvitationStatus } from '../models/event.types';
import { TableManager } from '../games/TableManager';
const getSafeIO = () => {
  try {
    const { getSocketIO } = require('../sockets');
    return getSocketIO ? getSocketIO() : null;
  } catch (_) {
    return null;
  }
};

const EVENTS_FILE = path.join(__dirname, '../../uploads/game_events.json');

const loadEvents = (): GameEvent[] => {
  try {
    if (fs.existsSync(EVENTS_FILE)) {
      const content = fs.readFileSync(EVENTS_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.warn('Failed to load game events:', e);
  }
  return [];
};

const saveEvents = (events: GameEvent[]) => {
  try {
    const dir = path.dirname(EVENTS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Failed to save game events:', e);
  }
};

let eventsStore: GameEvent[] = loadEvents();

export class EventService {
  /**
   * Create a new game event with invitations
   */
  public static createEvent(
    hostId: string,
    hostName: string,
    dto: CreateEventDTO
  ): { success: boolean; error?: string; event?: GameEvent } {
    if (!dto.title?.trim()) {
      return { success: false, error: 'Judul event tidak boleh kosong.' };
    }
    if (!dto.scheduledAt) {
      return { success: false, error: 'Waktu jadwal event harus ditentukan.' };
    }

    const scheduledDate = new Date(dto.scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return { success: false, error: 'Format waktu jadwal tidak valid.' };
    }

    const eventId = `evt_${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    const invitations: GameEventInvitation[] = (dto.invitees || []).map((inv) => ({
      id: `inv_${crypto.randomUUID().slice(0, 8)}`,
      eventId,
      inviteeId: inv.id,
      inviteeName: inv.name,
      message: inv.message || dto.description || 'Yuk ngopi dan main game bareng!',
      status: 'pending' as InvitationStatus,
      createdAt: now,
    }));

    const newEvent: GameEvent = {
      id: eventId,
      hostId,
      hostName,
      warungId: dto.warungId || null,
      gameType: dto.gameType || 'gapleh',
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      scheduledAt: scheduledDate.toISOString(),
      durationMin: dto.durationMin || 60,
      maxPlayers: dto.maxPlayers || 4,
      isPrivate: Boolean(dto.isPrivate),
      status: 'scheduled',
      tableId: null,
      invitations,
      createdAt: now,
    };

    eventsStore.unshift(newEvent);
    saveEvents(eventsStore);

    // Socket notification: Emit event:new_invitation to invitees
    const io = getSafeIO();
    if (io) {
      for (const inv of invitations) {
        io.to(inv.inviteeId).emit('event:new_invitation', {
          event: newEvent,
          invitation: inv,
        });
      }
    }

    return { success: true, event: newEvent };
  }

  /**
   * Get all events hosted by user
   */
  public static getMyEvents(userId: string): GameEvent[] {
    return eventsStore.filter((e) => e.hostId === userId);
  }

  /**
   * Get all invitations received by user
   */
  public static getInvitedEvents(userId: string): Array<{ event: GameEvent; invitation: GameEventInvitation }> {
    const list: Array<{ event: GameEvent; invitation: GameEventInvitation }> = [];
    for (const evt of eventsStore) {
      const inv = evt.invitations.find((i) => i.inviteeId === userId);
      if (inv) {
        list.push({ event: evt, invitation: inv });
      }
    }
    return list;
  }

  /**
   * Get single event by ID
   */
  public static getEventById(eventId: string): GameEvent | undefined {
    return eventsStore.find((e) => e.id === eventId);
  }

  /**
   * Respond to an invitation (accept or decline)
   */
  public static respondInvitation(
    eventId: string,
    userId: string,
    status: 'accepted' | 'declined'
  ): { success: boolean; error?: string; event?: GameEvent; invitation?: GameEventInvitation } {
    const evt = eventsStore.find((e) => e.id === eventId);
    if (!evt) {
      return { success: false, error: 'Event tidak ditemukan.' };
    }

    if (evt.status !== 'scheduled') {
      return { success: false, error: `Event sudah ${evt.status}.` };
    }

    const inv = evt.invitations.find((i) => i.inviteeId === userId);
    if (!inv) {
      return { success: false, error: 'Anda tidak memiliki undangan untuk event ini.' };
    }

    inv.status = status;
    inv.respondedAt = new Date().toISOString();
    saveEvents(eventsStore);

    // Socket notification to host
    const io = getSafeIO();
    if (io) {
      io.to(evt.hostId).emit('event:invitation_responded', {
        eventId: evt.id,
        inviteeId: userId,
        status,
        inviteeName: inv.inviteeName,
      });
    }

    return { success: true, event: evt, invitation: inv };
  }

  /**
   * Start event: Automatically creates GameTable in TableManager and links tableId!
   */
  public static async startEvent(
    eventId: string,
    hostUserId: string
  ): Promise<{ success: boolean; error?: string; tableId?: string; event?: GameEvent }> {
    const evt = eventsStore.find((e) => e.id === eventId);
    if (!evt) {
      return { success: false, error: 'Event tidak ditemukan.' };
    }

    if (evt.hostId !== hostUserId) {
      return { success: false, error: 'Hanya penyelenggara (Host) yang dapat memulai event ini.' };
    }

    if (evt.status === 'completed' || evt.status === 'cancelled') {
      return { success: false, error: `Event sudah selesai atau dibatalkan.` };
    }

    // Auto-create GameTable in TableManager
    const table = await TableManager.createTable({
      gameType: evt.gameType as any,
      name: `[Event] ${evt.title}`,
      maxPlayers: evt.maxPlayers,
      minPlayers: 2,
      isPrivate: evt.isPrivate,
      warungId: evt.warungId || undefined,
      host: {
        id: evt.hostId,
        user_id: evt.hostId,
        username: evt.hostName,
        display_name: evt.hostName,
        seat_number: 0,
        is_ready: true,
        is_active: true,
      },
    });

    evt.tableId = table.id;
    evt.status = 'ongoing';
    saveEvents(eventsStore);

    // Notify all accepted participants via Socket.IO
    const io = getSafeIO();
    if (io) {
      const acceptedInvitees = evt.invitations.filter((i) => i.status === 'accepted');
      for (const inv of acceptedInvitees) {
        io.to(inv.inviteeId).emit('event:started', {
          eventId: evt.id,
          tableId: table.id,
          gameType: evt.gameType,
          title: evt.title,
        });
      }
    }

    return { success: true, tableId: table.id, event: evt };
  }

  /**
   * Cancel event
   */
  public static cancelEvent(
    eventId: string,
    hostUserId: string
  ): { success: boolean; error?: string; event?: GameEvent } {
    const evt = eventsStore.find((e) => e.id === eventId);
    if (!evt) {
      return { success: false, error: 'Event tidak ditemukan.' };
    }

    if (evt.hostId !== hostUserId) {
      return { success: false, error: 'Hanya host yang dapat membatalkan event.' };
    }

    evt.status = 'cancelled';
    saveEvents(eventsStore);

    const io = getSafeIO();
    if (io) {
      for (const inv of evt.invitations) {
        io.to(inv.inviteeId).emit('event:cancelled', { eventId: evt.id, title: evt.title });
      }
    }

    return { success: true, event: evt };
  }

  /**
   * Check for reminders (events starting in <= 15 minutes)
   */
  public static checkReminders(): number {
    const now = Date.now();
    const io = getSafeIO();
    let remindersSent = 0;

    for (const evt of eventsStore) {
      if (evt.status !== 'scheduled') continue;
      const scheduledMs = new Date(evt.scheduledAt).getTime();
      const diffMs = scheduledMs - now;

      // Event is within next 15 minutes (and hasn't passed more than 5 minutes)
      if (diffMs > 0 && diffMs <= 15 * 60 * 1000) {
        if (io) {
          const targets = [evt.hostId, ...evt.invitations.filter((i) => i.status === 'accepted').map((i) => i.inviteeId)];
          for (const targetId of targets) {
            io.to(targetId).emit('event:reminder', {
              eventId: evt.id,
              title: evt.title,
              minutesRemaining: Math.ceil(diffMs / 60000),
            });
            remindersSent++;
          }
        }
      }
    }

    return remindersSent;
  }
}
