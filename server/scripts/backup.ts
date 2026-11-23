/** Manual backup: npm run backup  (same snapshot + rotation the server runs automatically). */
import 'dotenv/config';
import { runBackup } from '../src/ops/backup';
runBackup().then((i) => { console.log('OK', i); process.exit(0); }).catch((e) => { console.error('Backup failed:', e); process.exit(1); });
