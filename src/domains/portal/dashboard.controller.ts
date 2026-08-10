/**
 * Dashboard Controller - call history and portal dashboard
 */

import { Request, Response } from 'express';
import { RecordingRepository } from '../recording/recording.repository.js';

export class DashboardController {
  constructor(private recordingRepository: RecordingRepository) {}

  async getCallHistory(req: Request, res: Response): Promise<void> {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '10', 10);

    const result = await this.recordingRepository.findPaginated({ page, limit });

    res.json(result);
  }

  renderDashboard(_req: Request, res: Response): void {
    res.render('dashboard');
  }
}
