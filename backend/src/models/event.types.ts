export type GameEventStatus = 'scheduled' | 'ongoing' | 'completed' | 'cancelled';

export type InvitationStatus = 'pending' | 'accepted' | 'declined';

export interface GameEventInvitation {
  id: string;
  eventId: string;
  inviteeId: string;
  inviteeName: string;
  message?: string | null;
  status: InvitationStatus;
  respondedAt?: string | null;
  createdAt: string;
}

export interface GameEvent {
  id: string;
  hostId: string;
  hostName: string;
  warungId?: string | null;
  gameType: string;
  title: string;
  description?: string | null;
  scheduledAt: string; // ISO date string
  durationMin: number;
  maxPlayers: number;
  isPrivate: boolean;
  status: GameEventStatus;
  tableId?: string | null;
  invitations: GameEventInvitation[];
  createdAt: string;
}

export interface CreateEventDTO {
  title: string;
  description?: string;
  gameType: string;
  scheduledAt: string;
  durationMin?: number;
  maxPlayers?: number;
  isPrivate?: boolean;
  warungId?: string;
  invitees: Array<{ id: string; name: string; message?: string }>;
}
