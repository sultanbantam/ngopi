import { Router } from 'express';
import { createGroup, listGroups, joinGroup, getGroupMembers } from '../controllers/group.controller';
import { verifyJWT } from '../middleware/auth.middleware';

const router = Router();

router.use(verifyJWT);

router.post('/', createGroup);
router.get('/', listGroups);
router.get('/:id/members', getGroupMembers);
router.post('/:id/join', joinGroup);

export default router;
