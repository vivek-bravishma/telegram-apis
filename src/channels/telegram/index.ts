import type { ChannelModule } from '../../core/ChannelRegistry';
import { missingTelegramConfig, telegramConfig } from './telegram.config';
import { telegramRoutes } from './telegram.routes';

/** The channel's only export to the rest of the app. */
export const telegramChannel: ChannelModule = {
  name: telegramConfig.name,
  enabled: telegramConfig.enabled,
  routes: telegramRoutes,
  validate: missingTelegramConfig,
};

export { telegramService } from './telegram.service';
export { processUpdate } from './telegram.webhook';
