/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Hierarchical authorization rules for the Settings → Roster & Account
 * Access Control section and the UserService layer.
 */

import { User } from '@/types';

/** Operations that can be authorized. */
export type UserOperation =
  | 'view'            // Visible in the roster table
  | 'create'          // Create a new user (targetRole must also be passed)
  | 'edit'            // Edit non-permission properties (base office, reporting manager, username, etc.)
  | 'delete'          // Remove a user entirely
  | 'promote'         // Member → Lead
  | 'demote'          // Lead → Member
  | 'resetPassword'   // Force-reset a user's password
  | 'editPermissions' // Change page-level permissions
  | 'changeBaseOffice'
  | 'changeReportingManager';

/* ------------------------------------------------------------------ */
/*  Pure permission checks (used by both UI and service layer)        */
/* ------------------------------------------------------------------ */

/**
 * Whether `caller` may perform `operation` on the given `target` user.
 *
 * For the `create` operation, pass the prospective role as `targetRole`
 * (target itself is null because the user does not yet exist).
 *
 * Self-operations (caller operates on their own profile) are always
 * allowed for `edit` and `resetPassword`.
 */
export function authorize(
  caller: User,
  operation: UserOperation,
  target?: User | null,
  targetRole?: User['role'],
): boolean {
  // -------------------------------------------------------------------
  // Self-service: any user may edit their own profile or reset their
  // own password.
  // -------------------------------------------------------------------
  if (target && caller.id === target.id) {
    if (operation === 'edit' || operation === 'resetPassword') {
      return true;
    }
  }

  // -------------------------------------------------------------------
  // Super Admin — full access to everything, except:
  // - Cannot promote/demote the hardcoded superadmin account
  // - Cannot delete themselves (handled by the caller)
  // -------------------------------------------------------------------
  if (caller.role === 'superadmin') {
    if (target && target.id === 'superadmin') {
      if (operation === 'promote' || operation === 'demote') {
        return false;
      }
    }
    return true;
  }

  // -------------------------------------------------------------------
  // Member — no management capability
  // -------------------------------------------------------------------
  if (caller.role === 'member') {
    // Members can edit their own profile (handled above), but cannot
    // manage anyone else.
    return false;
  }

  // -------------------------------------------------------------------
  // Lead
  // -------------------------------------------------------------------
  if (caller.role === 'lead') {
    switch (operation) {
      case 'view':
        return target?.role === 'member' && isDirectReport(caller, target);

      case 'create':
        return targetRole === 'member';

      case 'edit':
      case 'changeBaseOffice':
      case 'changeReportingManager':
        return target?.role === 'member' && isDirectReport(caller, target);

      case 'delete':
      case 'promote':
      case 'demote':
      case 'resetPassword':
      case 'editPermissions':
        return false;

      default:
        return false;
    }
  }

  // -------------------------------------------------------------------
  // Admin
  // -------------------------------------------------------------------
  if (caller.role === 'admin') {
    switch (operation) {
      case 'view':
        // Admin cannot see Super Admin in the roster.
        return target?.role !== 'superadmin';

      case 'create':
        return targetRole !== 'superadmin' && targetRole !== undefined;

      case 'edit':
      case 'changeBaseOffice':
      case 'changeReportingManager':
        return target?.role !== 'superadmin';

      case 'delete':
        // Only Super Admin can delete users.
        return false;

      case 'promote':
      case 'demote':
        // Only Super Admin can promote/demote.
        return false;

      case 'resetPassword':
        return target?.role === 'lead' || target?.role === 'member';

      case 'editPermissions':
        return target?.role === 'lead' || target?.role === 'member';

      default:
        return false;
    }
  }

  // Guest — no management capability
  return false;
}

/* ------------------------------------------------------------------ */
/*  Helper(s)                                                          */
/* ------------------------------------------------------------------ */

function isDirectReport(manager: User, target: User): boolean {
  return (
    target.reportsTo === manager.id ||
    (manager.directReports || []).includes(target.id)
  );
}

/**
 * Filter a list of users so that `caller` only sees entries they are
 * authorised to view in the roster table.
 */
export function filterVisibleUsers(caller: User, allUsers: User[]): User[] {
  if (caller.role === 'superadmin') return allUsers;

  // If caller has no projectId (legacy admin), show all non-superadmin users
  if (!caller.projectId) {
    return allUsers.filter(u => u.role !== 'superadmin');
  }

  const projectUsers = allUsers.filter(
    u => u.projectId === caller.projectId,
  );

  if (caller.role === 'admin') {
    return projectUsers.filter(u => u.role !== 'superadmin');
  }

  if (caller.role === 'lead') {
    return projectUsers.filter(
      u =>
        u.role === 'member' &&
        (u.reportsTo === caller.id ||
          (caller.directReports || []).includes(u.id)),
    );
  }

  // Member / guest — no user management
  return [];
}
