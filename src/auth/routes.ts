import { Router } from 'express';
import { authenticate } from './middleware';
import {
  registerClient,
  generateToken,
  refreshToken,
  generateNewApiKey,
  revokeApiKey,
  listApiKeys,
  getProfile
} from './controller';
import {
  validate,
  validateParams,
  registerClientSchema,
  generateTokenSchema,
  refreshTokenSchema,
  revokeApiKeySchema
} from './validation';

const router = Router();

// Public routes (no authentication required)
router.post('/register', validate(registerClientSchema), registerClient);
router.post('/token', validate(generateTokenSchema), generateToken);
router.post('/refresh', validate(refreshTokenSchema), refreshToken);

// Protected routes (authentication required)
router.use(authenticate); // Apply authentication middleware to all routes below

router.get('/profile', getProfile);
router.get('/api-keys', listApiKeys);
router.post('/api-keys', generateNewApiKey);
router.delete('/api-keys/:keyId', validateParams(revokeApiKeySchema), revokeApiKey);

export default router;