import { Router } from 'express';
import {
  addGroupMember,
  approveGroupMember,
  createGroup,
  getGroupMembers,
  joinGroup,
  joinGroupByInvite,
  listGroups,
  regenerateInviteCode,
  removeGroupMember,
  updateGroup,
  updateGroupMemberRole,
} from '../controllers/group.controller';
import { verifyJWT } from '../middleware/auth.middleware';

const router = Router();

router.use(verifyJWT);

router.post('/', createGroup);
router.get('/', listGroups);
router.post('/invite/:code/join', joinGroupByInvite);
router.get('/:id/members', getGroupMembers);
router.put('/:id', updateGroup);
router.post('/:id/join', joinGroup);
router.post('/:id/invite/regenerate', regenerateInviteCode);
router.post('/:id/members', addGroupMember);
router.post('/:id/members/:userId/approve', approveGroupMember);
router.patch('/:id/members/:userId/role', updateGroupMemberRole);
router.delete('/:id/members/:userId', removeGroupMember);

export default router;
