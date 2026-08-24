// ============================================================
// AgentGate — Maintenance & Free-Tier Optimization Service
// 1. Anti-Sleep Keep-Alive Engine: Pings Supabase every 3.5 hrs
// 2. 15-Day Data Retention Engine: Prunes expired nonces & logs
// ============================================================

import { config } from '../config.js';
import { supabaseDb } from '../db/supabase-client.js';

export interface MaintenanceStatus {
  keepAlive: {
    enabled: boolean;
    intervalMs: number;
    lastPingAt: string | null;
    lastPingStatus: 'success' | 'failed' | 'idle';
    lastLatencyMs: number;
    totalPings: number;
  };
  retention: {
    enabled: boolean;
    retentionDays: number;
    lastCleanupAt: string | null;
    lastDeletedNonces: number;
    lastDeletedReservations: number;
  };
}

class MaintenanceService {
  private keepAliveTimer: NodeJS.Timeout | null = null;
  private retentionTimer: NodeJS.Timeout | null = null;

  private stats: MaintenanceStatus = {
    keepAlive: {
      enabled: true,
      intervalMs: config.maintenance.keepAliveIntervalMs,
      lastPingAt: null,
      lastPingStatus: 'idle',
      lastLatencyMs: 0,
      totalPings: 0,
    },
    retention: {
      enabled: true,
      retentionDays: config.maintenance.retentionDays,
      lastCleanupAt: null,
      lastDeletedNonces: 0,
      lastDeletedReservations: 0,
    },
  };

  /**
   * Start scheduled background maintenance jobs.
   */
  public start(): void {
    this.startKeepAlive();
    this.startRetentionWorker();
    console.log(`[MaintenanceService] Started: Keep-Alive (${(config.maintenance.keepAliveIntervalMs / 3600000).toFixed(1)}h), Retention (${config.maintenance.retentionDays}d).`);
  }

  /**
   * Stop scheduled background jobs (for graceful shutdown).
   */
  public stop(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
    if (this.retentionTimer) {
      clearInterval(this.retentionTimer);
      this.retentionTimer = null;
    }
    console.log('[MaintenanceService] Stopped background maintenance workers.');
  }

  /**
   * Keep-Alive Worker: Pings Supabase on startup and recurring intervals.
   */
  private startKeepAlive(): void {
    // Initial ping after 5 seconds
    setTimeout(() => {
      this.pingSupabase();
    }, 5000);

    // Recurring interval (default 3.5 hours)
    this.keepAliveTimer = setInterval(() => {
      this.pingSupabase();
    }, config.maintenance.keepAliveIntervalMs);
  }

  /**
   * Data Retention Worker: Runs daily to purge records older than 15 days.
   */
  private startRetentionWorker(): void {
    // Initial cleanup after 30 seconds
    setTimeout(() => {
      this.runCleanup(config.maintenance.retentionDays);
    }, 30000);

    // Run once every 24 hours
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    this.retentionTimer = setInterval(() => {
      this.runCleanup(config.maintenance.retentionDays);
    }, ONE_DAY_MS);
  }

  /**
   * Execute Keep-Alive ping.
   */
  public async pingSupabase(): Promise<{ success: boolean; latencyMs: number; error?: string }> {
    const result = await supabaseDb.executeRawPing();
    this.stats.keepAlive.lastPingAt = new Date().toISOString();
    this.stats.keepAlive.lastPingStatus = result.success ? 'success' : 'failed';
    this.stats.keepAlive.lastLatencyMs = result.latencyMs;
    this.stats.keepAlive.totalPings += 1;

    if (result.success) {
      console.log(`[Anti-Sleep Ping] Supabase keep-alive successful (${result.latencyMs}ms) at ${this.stats.keepAlive.lastPingAt}.`);
    } else {
      console.warn(`[Anti-Sleep Ping] Supabase keep-alive warning: ${result.error}`);
    }

    return result;
  }

  /**
   * Execute 15-day Data Retention Cleanup.
   */
  public async runCleanup(days: number = config.maintenance.retentionDays): Promise<{
    success: boolean;
    deletedNonces: number;
    deletedReservations: number;
    timestamp: string;
  }> {
    const result = await supabaseDb.pruneStaleRecords(days);
    this.stats.retention.lastCleanupAt = result.timestamp;
    this.stats.retention.lastDeletedNonces = result.deletedNonces;
    this.stats.retention.lastDeletedReservations = result.deletedReservations;
    return result;
  }

  /**
   * Get current maintenance status.
   */
  public getStatus(): MaintenanceStatus {
    return { ...this.stats };
  }
}

export const maintenanceService = new MaintenanceService();
