import path from 'path';

/**
 * Where the database, palm photos, backups and error logs live. In production set DATA_DIR to a persistent disk
 * (for example /data in the container); otherwise it is server/data next to the code.
 */
export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '..', '..', 'data');
