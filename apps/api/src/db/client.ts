import { Pool } from 'pg';
import { config } from '../config/env.js';

export const db = new Pool({ connectionString: config.databaseUrl });
