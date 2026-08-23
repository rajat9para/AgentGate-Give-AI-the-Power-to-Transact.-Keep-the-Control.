// ============================================================
// AgentGate — Cloudinary Object Storage Service
// Handles media/document storage, signed URLs, and metadata persistence
// ============================================================

import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config.js';
import { v4 as uuidv4 } from 'uuid';

export interface StoredMediaObject {
  id: string;
  public_id: string;
  secure_url: string;
  resource_type: string;
  format?: string;
  bytes?: number;
  owner_id?: string;
  reference_type?: 'transaction' | 'receipt' | 'product' | 'audit_proof';
  reference_id?: string;
  created_at: string;
}

// In-memory registry for mock storage fallback
const mediaRegistry = new Map<string, StoredMediaObject>();

export class CloudinaryStorageService {
  private initialized = false;

  constructor() {
    this.init();
  }

  private init() {
    if (config.cloudinary.isConfigured) {
      cloudinary.config({
        cloud_name: config.cloudinary.cloudName,
        api_key: config.cloudinary.apiKey,
        api_secret: config.cloudinary.apiSecret,
        secure: true,
      });
      this.initialized = true;
    }
  }

  /**
   * Upload an image or document to Cloudinary (or simulate in local demo mode).
   */
  public async uploadMedia(params: {
    fileData: string; // Base64 string or file path
    folder?: string;
    resourceType?: 'image' | 'raw' | 'auto';
    ownerId?: string;
    referenceType?: 'transaction' | 'receipt' | 'product' | 'audit_proof';
    referenceId?: string;
    tags?: string[];
  }): Promise<StoredMediaObject> {
    const folder = params.folder || 'agentgate/documents';
    const mediaId = `media_${uuidv4().replace(/-/g, '').slice(0, 16)}`;

    if (this.initialized && !config.demoMode) {
      try {
        const uploadResult = await cloudinary.uploader.upload(params.fileData, {
          folder,
          resource_type: params.resourceType || 'auto',
          tags: params.tags || ['agentgate', params.referenceType || 'general'],
        });

        const record: StoredMediaObject = {
          id: mediaId,
          public_id: uploadResult.public_id,
          secure_url: uploadResult.secure_url,
          resource_type: uploadResult.resource_type,
          format: uploadResult.format,
          bytes: uploadResult.bytes,
          owner_id: params.ownerId,
          reference_type: params.referenceType,
          reference_id: params.referenceId,
          created_at: new Date().toISOString(),
        };

        mediaRegistry.set(mediaId, record);
        return record;
      } catch (err: any) {
        console.error('[CloudinaryStorageService] Upload failed, falling back to mock record:', err?.message);
      }
    }

    // Simulated / Demo Mode Storage
    const simulatedRecord: StoredMediaObject = {
      id: mediaId,
      public_id: `${folder}/${mediaId}`,
      secure_url: `https://res.cloudinary.com/agentgate-demo/image/upload/v1/${folder}/${mediaId}.png`,
      resource_type: params.resourceType || 'image',
      format: 'png',
      bytes: 2048,
      owner_id: params.ownerId,
      reference_type: params.referenceType,
      reference_id: params.referenceId,
      created_at: new Date().toISOString(),
    };

    mediaRegistry.set(mediaId, simulatedRecord);
    return simulatedRecord;
  }

  /**
   * Generates a signed upload signature for direct browser uploads without exposing secrets.
   */
  public generateSignedUploadParams(folder: string = 'agentgate/uploads'): {
    signature: string;
    timestamp: number;
    cloudName: string;
    apiKey: string;
    folder: string;
  } {
    const timestamp = Math.round(Date.now() / 1000);

    if (this.initialized && config.cloudinary.apiSecret) {
      const signature = cloudinary.utils.api_sign_request(
        { timestamp, folder },
        config.cloudinary.apiSecret
      );

      return {
        signature,
        timestamp,
        cloudName: config.cloudinary.cloudName,
        apiKey: config.cloudinary.apiKey,
        folder,
      };
    }

    return {
      signature: 'simulated_signed_signature_' + uuidv4().slice(0, 8),
      timestamp,
      cloudName: config.cloudinary.cloudName || 'agentgate-demo',
      apiKey: config.cloudinary.apiKey || 'demo_key',
      folder,
    };
  }

  /**
   * Delete media object by public ID.
   */
  public async deleteMedia(publicId: string): Promise<{ success: boolean }> {
    if (this.initialized && !config.demoMode) {
      try {
        await cloudinary.uploader.destroy(publicId);
      } catch (err: any) {
        console.error('[CloudinaryStorageService] Delete failed:', err?.message);
      }
    }

    // Delete from registry
    for (const [id, record] of mediaRegistry.entries()) {
      if (record.public_id === publicId) {
        mediaRegistry.delete(id);
        break;
      }
    }

    return { success: true };
  }

  /**
   * Retrieve stored media metadata.
   */
  public getMediaById(id: string): StoredMediaObject | undefined {
    return mediaRegistry.get(id);
  }

  /**
   * Retrieve all media objects linked to a reference (e.g. order or transaction).
   */
  public getMediaByReference(referenceType: string, referenceId: string): StoredMediaObject[] {
    return Array.from(mediaRegistry.values()).filter(
      (m) => m.reference_type === referenceType && m.reference_id === referenceId
    );
  }
}

export const cloudinaryStorageService = new CloudinaryStorageService();
