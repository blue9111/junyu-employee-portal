export function isAllowedAccount(email: string | null | undefined): boolean {
  const normalized = email?.toLowerCase();
  return !!normalized && (/^[^@\s/]+@gotofunapp\.com$/.test(normalized) || externalAccounts.has(normalized));
}

export function approvedExternalName(email: string): string | undefined {
  return externalAccounts.get(email.toLowerCase());
}
const externalAccounts = new Map([
  ['cczr2ck@gmail.com', '李晉誠'],
  ['lchenchun1107@gmail.com', '林貞均'],
]);
