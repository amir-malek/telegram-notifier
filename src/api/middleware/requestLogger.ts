import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logRequest } from '../../monitoring/logger';

export interface RequestWithId extends Request {
  id: string;
  startTime: number;
}

export const requestLogger = (req: RequestWithId, res: Response, next: NextFunction): void => {
  // Generate unique request ID
  req.id = uuidv4();
  req.startTime = Date.now();

  // Add request ID to response headers
  res.setHeader('X-Request-ID', req.id);

  // Skip logging for health checks and metrics endpoints
  const skipPaths = ['/health', '/metrics'];
  if (skipPaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  // Log request start
  const { method, originalUrl, ip, headers } = req;

  // Capture response finish event
  const originalSend = res.send;
  res.send = function(body: any) {
    const responseTime = Date.now() - req.startTime;
    const contentLength = res.get('Content-Length') || body?.length || 0;

    // Log the request completion
    logRequest(method, originalUrl, res.statusCode, responseTime, {
      requestId: req.id,
      ip,
      userAgent: headers['user-agent'],
      contentLength,
      referer: headers.referer
    });

    // Call original send function
    return originalSend.call(this, body);
  };

  next();
};