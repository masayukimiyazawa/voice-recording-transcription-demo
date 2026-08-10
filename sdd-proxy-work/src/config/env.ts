import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

export const envSchema = z.object({
  VONAGE_API_KEY: z.string().min(1),
  VONAGE_API_SECRET: z.string().min(1),
  VONAGE_APPLICATION_ID: z.string().min(1),
  VONAGE_APPLICATION_PRIVATE_KEY_PATH: z.string().min(1),
  MONGODB_URI: z.string().url(),
  PORT: z.preprocess((val) => Number(val), z.number()).default(3000),
  SESSION_SECRET: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env;

export const getEnv = () => {
  if (!_env) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      console.error('❌ Invalid environment variables:', parsed.error.format());
      throw new Error('Invalid environment variables');
    }
    _env = parsed.data;
  }
  return _env;
};
