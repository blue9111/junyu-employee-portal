import type { Firestore } from 'firebase-admin/firestore';
import { isAllowedAccount, approvedExternalName } from './account-access';

export type Employee = { uid: string; email: string; name: string; employeeId: string };
type Identity = { uid: string; email?: string; email_verified?: boolean; firebase?: { sign_in_provider?: string } };

export async function resolveEmployee(db: Firestore, identity: Identity): Promise<Employee | null> {
  const email = identity.email?.toLowerCase();
  if (!identity.uid || !email || !isAllowedAccount(email) ||
      identity.email_verified !== true || identity.firebase?.sign_in_provider !== 'google.com') return null;
  const employeeRef = db.collection('meeting_employees').doc(email);
  const bindingRef = db.collection('meeting_employee_bindings').doc(identity.uid);
  return db.runTransaction(async tx => {
    const [employeeSnap, bindingSnap] = await Promise.all([tx.get(employeeRef), tx.get(bindingRef)]);
    const approvedName = approvedExternalName(email);
    // Provision only the exact externally approved account, after Google verification.
    // Existing deactivation and UID bindings always take precedence.
    const employee = employeeSnap.data() ?? (approvedName ? { name: approvedName, active: true, employeeId: '' } : null);
    if (!employee || employee.active !== true || typeof employee.name !== 'string' ||
        !employee.name.trim() || employee.name.trim().length > 80 ||
        (employee.boundUid && employee.boundUid !== identity.uid) ||
        (bindingSnap.exists && bindingSnap.data()?.email !== email)) return null;
    if (employee.employeeId != null && typeof employee.employeeId !== 'string') return null;
    if (!employeeSnap.exists) tx.create(employeeRef, { ...employee, boundUid: identity.uid });
    else {
      const changes: { boundUid?: string; name?: string } = {};
      if (!employee.boundUid) changes.boundUid = identity.uid;
      if (approvedName && employee.name !== approvedName) changes.name = approvedName;
      if (Object.keys(changes).length) tx.update(employeeRef, changes);
    }
    if (!bindingSnap.exists) tx.create(bindingRef, {email});
    return {uid:identity.uid, email, name:approvedName || employee.name.trim(), employeeId:employee.employeeId || ''};
  });
}
