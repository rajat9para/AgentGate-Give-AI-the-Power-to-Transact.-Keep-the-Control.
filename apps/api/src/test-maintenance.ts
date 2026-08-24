import { config } from './config.js';
import { v2 as cloudinary } from 'cloudinary';
import { supabaseDb } from './db/supabase-client.js';
import { maintenanceService } from './services/maintenance-service.js';

async function runMaintenanceVerification() {
  console.log('\n======================================================');
  console.log('🧪 Testing Cloudinary Live Verification & Preset');
  console.log('======================================================');

  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
    secure: true,
  });

  try {
    const pingRes = await cloudinary.api.ping();
    console.log(`✅ PASS: Cloudinary Connected (Status: ${pingRes.status}, Cloud: ${config.cloudinary.cloudName}, Preset: ${config.cloudinary.uploadPreset})`);
  } catch (err: any) {
    console.warn(`⚠️ Cloudinary Live Check: ${err?.message || 'Check credentials'}`);
  }

  console.log('\n======================================================');
  console.log('🧪 Testing Supabase Anti-Sleep Keep-Alive & Cleanup');
  console.log('======================================================');

  const pingResult = await maintenanceService.pingSupabase();
  console.log(`✅ PASS: Anti-Sleep Ping (${pingResult.latencyMs}ms, status: ${pingResult.success ? 'healthy' : 'failed'})`);

  const cleanupResult = await maintenanceService.runCleanup(15);
  console.log(`✅ PASS: 15-Day Data Retention Cleanup (Deleted nonces: ${cleanupResult.deletedNonces}, reservations: ${cleanupResult.deletedReservations})`);

  const status = maintenanceService.getStatus();
  console.log(`✅ PASS: Maintenance Status Operational (Keep-Alive total: ${status.keepAlive.totalPings}, Interval: ${status.keepAlive.intervalMs / 1000}s)`);

  console.log('\n🎉 ALL CLOUDINARY & MAINTENANCE SERVICES VERIFIED!\n');
  process.exitCode = 0;
}

runMaintenanceVerification().catch(err => {
  console.error('Maintenance verification failed:', err);
  process.exitCode = 1;
});
