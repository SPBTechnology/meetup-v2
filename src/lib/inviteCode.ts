/** Formats a raw invite code for display, e.g. "ABCDEFGH" -> "ABCD-EFGH". */
export function formatInviteCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}
