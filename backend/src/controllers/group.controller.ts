import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { getBmcBalance } from '../utils/blockchain';

const normalizeMinBmcBalance = (value: unknown) => {
  const parsed = Number.parseFloat(String(value ?? 0));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const normalizeJoinPolicy = (value: unknown) => value === 'approval' ? 'approval' : 'open';
const normalizeBoolean = (value: unknown, fallback: boolean) => typeof value === 'boolean' ? value : fallback;
const createInviteCode = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

const ensureInviteCode = async (group: { id: string; invite_code?: string | null }) => {
  if (group.invite_code) return group.invite_code;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const invite_code = createInviteCode();
    try {
      await prisma.group.update({ where: { id: group.id }, data: { invite_code } });
      return invite_code;
    } catch (error) {
      if (attempt === 3) throw error;
    }
  }
  return createInviteCode();
};

const getMembership = (groupId: string, userId: string) => prisma.groupMember.findUnique({
  where: { group_id_user_id: { group_id: groupId, user_id: userId } }
});

const isGroupAdmin = async (groupId: string, userId: string) => {
  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { created_by: true } });
  if (group?.created_by === userId) return true;
  const member = await getMembership(groupId, userId);
  return member?.status === 'active' && member?.role === 'admin';
};

const serializeGroup = async (group: any) => ({
  ...group,
  invite_code: await ensureInviteCode(group),
});

export const createGroup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, avatarUrl, minBmcBalance, joinPolicy, onlyAdminsCanSend, allowMemberInvites, callEnabled } = req.body;
    const userId = (req as any).user?.id as string;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const trimmedName = typeof name === 'string' ? name.trim() : '';
    if (!trimmedName) {
      res.status(400).json({ error: 'Group name is required' });
      return;
    }

    const memberIds = [...new Set<string>((req.body.memberIds || []) as string[])].filter(id => id !== userId);
    if (memberIds.length) {
      const count = await prisma.user.count({ where: { id: { in: memberIds } } });
      if (count !== memberIds.length) { res.status(400).json({ error: 'Sebagian anggota tidak ditemukan' }); return; }
    }

    const group = await prisma.group.create({
      data: {
        name: trimmedName,
        description: typeof description === 'string' && description.trim() ? description.trim() : null,
        avatar_url: typeof avatarUrl === 'string' && avatarUrl.trim() ? avatarUrl.trim() : null,
        min_bmc_balance: normalizeMinBmcBalance(minBmcBalance),
        invite_code: createInviteCode(),
        join_policy: normalizeJoinPolicy(joinPolicy),
        only_admins_can_send: normalizeBoolean(onlyAdminsCanSend, false),
        allow_member_invites: normalizeBoolean(allowMemberInvites, true),
        call_enabled: normalizeBoolean(callEnabled, true),
        created_by: userId,
        members: {
          create: [
            { user_id: userId, role: 'admin', status: 'active' },
            ...memberIds.map(id => ({ user_id: id, role: 'member', status: 'active', invited_by: userId })),
          ]
        }
      },
      include: {
        _count: { select: { members: true } }
      }
    });

    res.status(201).json(group);
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const listGroups = async (req: Request, res: Response): Promise<void> => {
  try {
    const groups = await prisma.group.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        _count: { select: { members: true } }
      }
    });
    res.json(await Promise.all(groups.map(serializeGroup)));
  } catch (error) {
    console.error('List groups error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getGroupMembers = async (req: Request, res: Response): Promise<void> => {
  try {
    const groupId = req.params.id as string;
    const userId = (req as any).user?.id as string;
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          orderBy: [{ role: 'asc' }, { joined_at: 'asc' }],
          include: {
            user: {
              select: { id: true, username: true, display_name: true, avatar_url: true, is_online: true, wallet_address: true }
            }
          }
        }
      }
    });

    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    const inviteCode = await ensureInviteCode(group);
    res.json({
      group_id: group.id,
      group_name: group.name,
      description: group.description,
      avatar_url: group.avatar_url,
      min_bmc_balance: group.min_bmc_balance,
      invite_code: inviteCode,
      invite_url: `https://ngopi.top/contacts?join=${inviteCode}`,
      join_policy: group.join_policy,
      only_admins_can_send: group.only_admins_can_send,
      allow_member_invites: group.allow_member_invites,
      call_enabled: group.call_enabled,
      created_by: group.created_by,
      is_admin: userId ? await isGroupAdmin(group.id, userId) : false,
      members: group.members.map(m => ({
        user_id: m.user.id,
        username: m.user.username,
        display_name: m.user.display_name,
        avatar_url: m.user.avatar_url,
        is_online: m.user.is_online,
        wallet_address: m.user.wallet_address,
        role: m.role,
        status: m.status,
        invited_by: m.invited_by,
        joined_at: m.joined_at
      }))
    });
  } catch (error) {
    console.error('Get group members error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const assertCanJoinGroup = async (group: any, userId: string) => {
  if (group.min_bmc_balance <= 0) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.wallet_address) return 'Wallet address is required to join this token-gated group. Please update your profile.';
  const balance = await getBmcBalance(user.wallet_address);
  if (balance < group.min_bmc_balance) return `Insufficient BMC balance. You need at least ${group.min_bmc_balance} BMC to join this group. Current balance: ${balance} BMC`;
  return null;
};

export const joinGroup = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = (req as any).user?.id as string;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const group = await prisma.group.findUnique({ where: { id } });
    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    const gateError = await assertCanJoinGroup(group, userId);
    if (gateError) {
      res.status(403).json({ error: gateError });
      return;
    }

    const existingMember = await getMembership(id, userId);
    if (existingMember) {
      if (existingMember.status === 'pending') {
        res.status(202).json({ message: 'Join request is waiting for admin approval', pendingApproval: true });
        return;
      }
      res.status(200).json({ message: 'Already a member of this group', alreadyMember: true });
      return;
    }

    const status = group.join_policy === 'approval' ? 'pending' : 'active';
    await prisma.groupMember.create({
      data: { group_id: id, user_id: userId, role: 'member', status }
    });

    res.status(status === 'pending' ? 202 : 200).json({
      message: status === 'pending' ? 'Join request sent to admins' : 'Successfully joined group',
      pendingApproval: status === 'pending'
    });
  } catch (error) {
    console.error('Join group error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const joinGroupByInvite = async (req: Request, res: Response): Promise<void> => {
  try {
    const code = req.params.code as string;
    const group = await prisma.group.findFirst({ where: { invite_code: code } });
    if (!group) {
      res.status(404).json({ error: 'Invite link is invalid or expired' });
      return;
    }
    req.params.id = group.id;
    return joinGroup(req, res);
  } catch (error) {
    console.error('Join by invite error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateGroup = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = (req as any).user?.id as string;
    const { name, description, avatarUrl, minBmcBalance, joinPolicy, onlyAdminsCanSend, allowMemberInvites, callEnabled } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!(await isGroupAdmin(id, userId))) {
      res.status(403).json({ error: 'Only group admins can edit this group' });
      return;
    }

    const trimmedName = typeof name === 'string' ? name.trim() : '';
    if (!trimmedName) {
      res.status(400).json({ error: 'Group name is required' });
      return;
    }

    const updatedGroup = await prisma.group.update({
      where: { id },
      data: {
        name: trimmedName,
        description: typeof description === 'string' && description.trim() ? description.trim() : null,
        avatar_url: typeof avatarUrl === 'string' && avatarUrl.trim() ? avatarUrl.trim() : null,
        min_bmc_balance: normalizeMinBmcBalance(minBmcBalance),
        join_policy: normalizeJoinPolicy(joinPolicy),
        only_admins_can_send: normalizeBoolean(onlyAdminsCanSend, false),
        allow_member_invites: normalizeBoolean(allowMemberInvites, true),
        call_enabled: normalizeBoolean(callEnabled, true),
      },
      include: { _count: { select: { members: true } } }
    });

    res.status(200).json(await serializeGroup(updatedGroup));
  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const addGroupMember = async (req: Request, res: Response): Promise<void> => {
  try {
    const groupId = req.params.id as string;
    const actorId = (req as any).user?.id as string;
    const { userId, role = 'member' } = req.body;

    if (!actorId || !(await isGroupAdmin(groupId, actorId))) {
      res.status(403).json({ error: 'Only group admins can add members' });
      return;
    }
    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const member = await prisma.groupMember.upsert({
      where: { group_id_user_id: { group_id: groupId, user_id: userId } },
      create: { group_id: groupId, user_id: userId, role: role === 'admin' ? 'admin' : 'member', status: 'active', invited_by: actorId },
      update: { status: 'active', role: role === 'admin' ? 'admin' : 'member', invited_by: actorId }
    });

    res.status(200).json(member);
  } catch (error) {
    console.error('Add group member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const approveGroupMember = async (req: Request, res: Response): Promise<void> => {
  try {
    const groupId = req.params.id as string;
    const userId = req.params.userId as string;
    const actorId = (req as any).user?.id as string;
    if (!actorId || !(await isGroupAdmin(groupId, actorId))) {
      res.status(403).json({ error: 'Only group admins can approve members' });
      return;
    }
    const member = await prisma.groupMember.update({
      where: { group_id_user_id: { group_id: groupId, user_id: userId } },
      data: { status: 'active' }
    });
    res.status(200).json(member);
  } catch (error) {
    console.error('Approve group member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const removeGroupMember = async (req: Request, res: Response): Promise<void> => {
  try {
    const groupId = req.params.id as string;
    const userId = req.params.userId as string;
    const actorId = (req as any).user?.id as string;
    if (!actorId || (actorId !== userId && !(await isGroupAdmin(groupId, actorId)))) {
      res.status(403).json({ error: 'Only group admins can remove members' });
      return;
    }
    const group = await prisma.group.findUnique({ where: { id: groupId }, select: { created_by: true } });
    if (group?.created_by === userId) {
      res.status(400).json({ error: 'Group creator cannot be removed' });
      return;
    }
    await prisma.groupMember.delete({ where: { group_id_user_id: { group_id: groupId, user_id: userId } } });
    res.status(200).json({ message: 'Member removed' });
  } catch (error) {
    console.error('Remove group member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateGroupMemberRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const groupId = req.params.id as string;
    const userId = req.params.userId as string;
    const actorId = (req as any).user?.id as string;
    const role = req.body?.role === 'admin' ? 'admin' : 'member';
    if (!actorId || !(await isGroupAdmin(groupId, actorId))) {
      res.status(403).json({ error: 'Only group admins can update roles' });
      return;
    }
    const group = await prisma.group.findUnique({ where: { id: groupId }, select: { created_by: true } });
    if (group?.created_by === userId && role !== 'admin') {
      res.status(400).json({ error: 'Group creator must remain an admin' });
      return;
    }

    const member = await prisma.groupMember.update({
      where: { group_id_user_id: { group_id: groupId, user_id: userId } },
      data: { role }
    });
    res.status(200).json(member);
  } catch (error) {
    console.error('Update group member role error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const regenerateInviteCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const groupId = req.params.id as string;
    const actorId = (req as any).user?.id as string;
    if (!actorId || !(await isGroupAdmin(groupId, actorId))) {
      res.status(403).json({ error: 'Only group admins can regenerate invite links' });
      return;
    }
    const invite_code = createInviteCode();
    const group = await prisma.group.update({ where: { id: groupId }, data: { invite_code } });
    res.status(200).json({ invite_code, invite_url: `https://ngopi.top/contacts?join=${group.invite_code}` });
  } catch (error) {
    console.error('Regenerate invite code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
