import { z } from 'zod';

import {
  prayerAppBackupPayloadSchema,
} from '../validation';

export { prayerAppBackupPayloadSchema };

export const googleDriveAuthStartBodySchema = z.object({
  installationId: z.string().trim().min(1).max(120),
  platform: z.enum(['android', 'ios', 'web']),
  redirectUri: z.string().trim().url(),
});

export const googleDriveAuthCompleteBodySchema = z.object({
  installationId: z.string().trim().min(1).max(120),
  state: z.string().trim().min(1),
});

export const googleDriveBackupUpsertBodySchema = z.object({
  backup: prayerAppBackupPayloadSchema,
});

export const googleDriveExportDocumentBodySchema = z.object({
  folderName: z.string().trim().min(1).max(120).regex(/^[a-zA-Z0-9\s._-]+$/, 'Folder name contains invalid characters.'),
  fileName: z.string().trim().min(1).max(120).regex(/^[a-zA-Z0-9\s._-]+\.[a-zA-Z0-9]+$/, 'File name must be a valid name with an extension.'),
  content: z.string().trim().min(1),
  mimeType: z.string().trim().min(1).max(120),
});
