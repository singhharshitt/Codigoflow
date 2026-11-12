import fs from 'fs';
import path from 'path';

describe('secret exposure guards', () => {
  it('does not reference VITE_DEVOPS_API_TOKEN in the client source tree', () => {
    const clientSrc = path.resolve(__dirname, '../../../client/src');
    const hits: string[] = [];

    function walk(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx|js|jsx)$/.test(entry.name)) continue;
        const text = fs.readFileSync(full, 'utf8');
        if (text.includes('VITE_DEVOPS_API_TOKEN')) hits.push(full);
      }
    }

    walk(clientSrc);
    expect(hits).toEqual([]);
  });

  it('client http client enables credentials for session cookies', () => {
    const httpPath = path.resolve(__dirname, '../../../client/src/services/http.ts');
    const text = fs.readFileSync(httpPath, 'utf8');
    expect(text).toContain('withCredentials: true');
    expect(text).not.toContain('VITE_DEVOPS_API_TOKEN');
  });
});
