import { createApp } from './app';
import { channelRegistry } from './channels';
import { config } from './config';
import { ensureDir } from './utils/media';
import { logger } from './utils/logger';

function validateChannels(): void {
  const problems = channelRegistry.validate();

  if (problems.length === 0) return;

  for (const problem of problems) {
    logger.error(`Channel "${problem.channel}" is enabled but not configured`, {
      missing: problem.missing,
    });
  }

  throw new Error(
    `Missing required configuration: ${problems
      .flatMap((problem) => problem.missing)
      .join(', ')}. Set them in .env or disable the channel.`,
  );
}

function start(): void {
  ensureDir(config.paths.uploads);
  validateChannels();

  const app = createApp();

  const server = app.listen(config.port, () => {
    logger.info(`telegram-apis listening on port ${config.port}`, {
      env: config.env,
      publicBaseUrl: config.publicBaseUrl,
      channels: channelRegistry.enabled().map((channel) => channel.name),
    });
  });

  const shutdown = (signal: string) => () => {
    logger.info(`${signal} received, shutting down`);
    server.close(() => process.exit(0));
  };

  process.on('SIGTERM', shutdown('SIGTERM'));
  process.on('SIGINT', shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { reason: String(reason) });
  });
}

try {
  start();
} catch (error) {
  logger.error('Startup failed', { error: error instanceof Error ? error.message : error });
  process.exit(1);
}
