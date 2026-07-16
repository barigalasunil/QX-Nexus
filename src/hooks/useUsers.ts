import { useEffect, useState } from 'react';
import { User } from '@/types';
import { UserService } from '@/services/user.service';

/**
 * useUsers — reactively provides the full list of users from the Supabase-backed
 * UserService.  It subscribes to UserService cache changes and triggers a
 * re-fetch on mount so that components always see the latest data without
 * needing a browser refresh.
 *
 * After every Create / Edit / Delete operation the caller should await the
 * relevant UserService method (e.g. createUser / updateUser / deleteUser)
 * which internally calls fetchAll → notifyListeners → this hook updates →
 * component re-renders.
 */
export function useUsers(): User[] {
  const [users, setUsers] = useState<User[]>(() => UserService.getUsersSync());

  useEffect(() => {
    // Subscribe to future cache changes
    const unsubscribe = UserService.subscribe(() => {
      const synced = UserService.getUsersSync();
      console.log("Users loaded into App:", synced.length);
      setUsers(synced);
    });

    // If cache is still empty on mount, trigger a fetch.
    // UserService.getUsers() will re-use any in-flight promise.
    if (UserService.getUsersSync().length === 0) {
      UserService.getUsers(); // Fire-and-forget: subscribe callback updates state on completion
    }

    return unsubscribe;
  }, []);

  console.log("AppState users:", users.length);
  return users;
}
