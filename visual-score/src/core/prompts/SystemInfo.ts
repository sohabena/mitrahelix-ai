import * as os from 'os';

export function getSystemInfo(workspaceRoot: string): string {
  const platform = process.platform;
  const osName = platform === 'win32' ? 'Windows' : platform === 'darwin' ? 'macOS' : 'Linux';
  const shell = platform === 'win32'
    ? process.env.COMSPEC || 'powershell.exe'
    : process.env.SHELL || '/bin/sh';
  const homeDir = os.homedir();

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  return [
    `- OS: ${osName}`,
    `- Shell: ${shell}`,
    `- CWD: ${workspaceRoot}`,
    `- Home: ${homeDir}`,
    `- Date: ${dateStr}`,
    `- Time: ${timeStr}`,
  ].join('\n');
}
