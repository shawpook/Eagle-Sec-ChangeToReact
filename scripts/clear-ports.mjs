import { execSync } from 'node:child_process';

const ports = [5176, 41695, 41692, 41693];

for (const port of ports) {
  try {
    const output = execSync(`netstat -ano | findstr ":${port} " | findstr "LISTENING"`, { encoding: 'utf8', timeout: 5000 });
    for (const line of output.trim().split('\n')) {
      const pid = line.trim().split(/\s+/).pop();
      if (pid && pid !== '0') {
        try {
          execSync(`taskkill /F /PID ${pid}`, { timeout: 5000 });
          console.log(`[cleanup] Killed PID ${pid} on port ${port}`);
        } catch {}
      }
    }
  } catch {}
}
console.log('[cleanup] Ports cleared.');
