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
import { validateRequest } from '../middleware/validation';
import {
  addGroupMemberSchema,
  createGroupSchema,
  idParamsSchema,
  inviteCodeParamsSchema,
  updateGroupMemberRoleSchema,
  updateGroupSchema,
  userIdParamsSchema,
} from '../utils/validation';

const router = Router();

router.use(verifyJWT);

router.post('/', validateRequest({ body: createGroupSchema }), createGroup);
router.get('/', listGroups);
router.post('/invite/:code/join', validateRequest({ params: inviteCodeParamsSchema }), joinGroupByInvite);
router.get('/:id/members', validateRequest({ params: idParamsSchema }), getGroupMembers);
router.put('/:id', validateRequest({ params: idParamsSchema, body: updateGroupSchema }), updateGroup);
router.post('/:id/join', validateRequest({ params: idParamsSchema }), joinGroup);
router.post('/:id/invite/regenerate', validateRequest({ params: idParamsSchema }), regenerateInviteCode);
router.post('/:id/members', validateRequest({ params: idParamsSchema, body: addGroupMemberSchema }), addGroupMember);
router.post('/:id/members/:userId/approve', validateRequest({ params: userIdParamsSchema }), approveGroupMember);
router.patch('/:id/members/:userId/role', validateRequest({ params: userIdParamsSchema, body: updateGroupMemberRoleSchema }), updateGroupMemberRole);
router.delete('/:id/members/:userId', validateRequest({ params: userIdParamsSchema }), removeGroupMember);

export default router;