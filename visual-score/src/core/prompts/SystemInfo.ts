import * as os from 'os';

export function getSystemInfo(workspaceRoot: string): string {
  const platform = process.platform;
  const osName = platform === 'win32' ? 'Windows' : platform === 'darwin' ? 'macOS' : 'Linux';
  const shell = platform === 'win32'
    ? process.env.COMSPEC || 'powershell.exe'
    : process.env.SHELL || '/bin/sh';
  const homeDir = os.homedir();

  return [
    `- OS: ${osName}`,
    `- Shell: ${shell}`,
    `- CWD: ${workspaceRoot}`,
    `- Home: ${homeDir}`,
  ].join('\n');
}
