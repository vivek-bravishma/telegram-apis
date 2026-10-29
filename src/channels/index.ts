import { channelRegistry } from '../core/ChannelRegistry';
import { telegramChannel } from './telegram';

/*
 * ── Adding a channel ───────────────────────────────────────────────────────
 * 1. Create src/channels/<name>/ with its own config, types, validation,
 *    mapper, service, controller and routes (copy the telegram folder).
 * 2. Export a ChannelModule from that folder's index.ts.
 * 3. Add one register() line below.
 *
 * Nothing else changes: the router mounts whatever is registered here at
 * /api/<name>, and server boot validates its env vars automatically.
 */
channelRegistry.register(telegramChannel);

export { channelRegistry };
