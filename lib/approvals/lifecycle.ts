export interface ApprovalRecord {
  id: number;
  status: string;
  expiresAt: Date;
}

export function isApprovalExpired(approval: ApprovalRecord): boolean {
  return new Date() > approval.expiresAt;
}

export function getApprovalExpiresAt(ttlMinutes: number): Date {
  return new Date(Date.now() + ttlMinutes * 60 * 1000);
}

export const RAIL1_APPROVAL_TTL_MINUTES = 5;
export const RAIL2_APPROVAL_TTL_MINUTES = 15;
