import { db } from '../database/db';
import { createLocalProductService } from './localProductService';

// App startup already awaits initializeDatabase(). No additional database is opened.
export const localProducts = createLocalProductService(db);
