import { Response } from 'express';

export class ResponseView {
  static success(res: Response, data: any, statusCode: number = 200) {
    return res.status(statusCode).json(data);
  }

  static created(res: Response, data: any) {
    return res.status(201).json(data);
  }

  static error(res: Response, message: string, statusCode: number = 400, details?: any) {
    return res.status(statusCode).json({ error: message, details });
  }

  static unauthorized(res: Response, message: string = 'Unauthorized access') {
    return res.status(401).json({ error: message });
  }

  static forbidden(res: Response, message: string = 'Forbidden action') {
    return res.status(403).json({ error: message });
  }

  static notFound(res: Response, message: string = 'Resource not found') {
    return res.status(404).json({ error: message });
  }

  static serverError(res: Response, message: string = 'Internal server error', error?: any) {
    console.error('API Exception:', error || message);
    return res.status(500).json({ error: message });
  }
}
