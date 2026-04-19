import type { FastifyReply, FastifyRequest } from 'fastify';
import type { GoogleDriveService } from './google-drive/service';

function getSessionTokenFromHeaders(headers: Record<string, unknown>) {
  const rawHeader = headers['x-prayer-app-session'];

  if (typeof rawHeader === 'string' && rawHeader.trim().length > 0) {
    return rawHeader.trim();
  }

  if (Array.isArray(rawHeader)) {
    const token = rawHeader.find((value) => typeof value === 'string' && value.trim().length > 0);
    return typeof token === 'string' ? token.trim() : null;
  }

  return null;
}

export function requireGoogleSession(googleDriveService: GoogleDriveService) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const sessionToken = getSessionTokenFromHeaders(request.headers as Record<string, unknown>);

    if (!sessionToken) {
      reply.code(401).send({ error: { code: 'missing_google_session', message: 'Google session token is required.' } });
      return;
    }

    try {
      const session = await googleDriveService.getSession(sessionToken as string);

      if (!session) {
        reply.code(401).send({ error: { code: 'invalid_google_session', message: 'Google session is no longer valid.' } });
        return;
      }

      // Attach lightweight session info to the request for handlers to consume.
      (request as any).prayerAppGoogleSession = {
        sessionToken: sessionToken as string,
        account: session.account,
      };
    } catch (err) {
      request.log.error({ err }, 'Failed to validate Google session');
      reply.code(500).send({ error: { code: 'internal_error', message: 'Failed to validate Google session.' } });
      return;
    }
  };
}
