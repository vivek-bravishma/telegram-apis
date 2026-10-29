import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { channelRegistry } from './channels';
import { ok } from './core/response';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { requestLogger } from './middlewares/requestLogger';
import apiRoutes from './routes';

export function createApp(): Express {
  const app = express();

  app.set('trust proxy', true);

  app.use(
    helmet({
      // Media under /uploads is fetched cross-origin by chat clients.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(
    cors({
      origin: config.http.allowedOrigins.includes('*') ? true : config.http.allowedOrigins,
    }),
  );

  app.use(express.json({ limit: config.http.bodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: config.http.bodyLimit }));
  app.use(requestLogger);

  app.get('/health', (_req, res) => {
    ok(res, {
      status: 'ok',
      env: config.env,
      uptimeSeconds: Math.round(process.uptime()),
      channels: channelRegistry.enabled().map((channel) => channel.name),
    });
  });

  // Media downloaded from a provider is served back from here.
  app.use(config.uploads.publicPath, express.static(config.paths.uploads, { maxAge: '1h' }));

  app.use('/api', apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
