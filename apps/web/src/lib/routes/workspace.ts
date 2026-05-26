export type Workspace = 'platform' | 'tenant';

export function getWorkspaceFromPath(pathname: string): Workspace {
  return pathname.startsWith('/platform') ? 'platform' : 'tenant';
}
