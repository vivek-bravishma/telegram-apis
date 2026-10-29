import { Router } from 'express';
import { channelRegistry } from '../channels';
import { ok } from '../core/response';

const router = Router();

/** GET /api/channels — what is mounted and whether it is configured. */
router.get('/channels', (_req, res) => {
  ok(
    res,
    channelRegistry.all().map((channel) => ({
      name: channel.name,
      enabled: channel.enabled,
      basePath: `/api/${channel.name}`,
      configured: channel.validate().length === 0,
    })),
  );
});

// Every registered channel is mounted under its own name. Adding a channel
// needs no edit here.
for (const channel of channelRegistry.enabled()) {
  router.use(`/${channel.name}`, channel.routes);
}

export default router;
