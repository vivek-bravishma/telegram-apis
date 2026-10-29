import type { Router } from 'express';
import { AppError } from './errors';

/**
 * What a channel must expose to be mounted. Adding a channel means writing one
 * of these and registering it — no edits to the router, app or server.
 */
export interface ChannelModule {
  /** URL segment and display name, e.g. "telegram" → /api/telegram/... */
  name: string;
  enabled: boolean;
  routes: Router;
  /** Returns the names of env vars that are required but missing. */
  validate(): string[];
}

class ChannelRegistry {
  private readonly modules = new Map<string, ChannelModule>();

  register(module: ChannelModule): void {
    if (this.modules.has(module.name)) {
      throw new AppError(`Duplicate channel registration: "${module.name}"`, 500, 'DUPLICATE_CHANNEL');
    }
    this.modules.set(module.name, module);
  }

  get(name: string): ChannelModule | undefined {
    return this.modules.get(name);
  }

  all(): ChannelModule[] {
    return [...this.modules.values()];
  }

  enabled(): ChannelModule[] {
    return this.all().filter((module) => module.enabled);
  }

  /** Aggregated config problems across every enabled channel. */
  validate(): { channel: string; missing: string[] }[] {
    return this.enabled()
      .map((module) => ({ channel: module.name, missing: module.validate() }))
      .filter((result) => result.missing.length > 0);
  }
}

export const channelRegistry = new ChannelRegistry();
