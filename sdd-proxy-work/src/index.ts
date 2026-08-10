import express, { Request, Response } from 'express';
import { getEnv } from './config/env';
import { errorHandler } from './config/errorHandler';
import { logger } from './config/logger';

const app = express();
const env = getEnv();

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.send('Vonage Call Proxy is running');
});

app.use(errorHandler);

app.listen(env.PORT, () => {
  logger.info(`Server is running on port ${env.PORT}`);
});
