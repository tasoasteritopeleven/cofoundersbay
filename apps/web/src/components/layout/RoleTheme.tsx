"use client";

import { useEffect, useState, createContext, useContext, useCallback } from 'react';

type Theme = 'dark' | 'light' | 'system' | 'alliance' | 'cofounder' | 'minimal' | 'apricot';
type Role = 'founder' | 'mentor' | 'investor' | 'org' | null;

const roleClasses = ['role-founder', 'role-mentor', 'role-investor', 'role-org'];

type ThemeContextType = {
  theme: Theme;
  role: Role;
  setTheme: (theme: Theme) => void;
  setRole: (role: Role) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within RoleTheme');
  }
  return context;
}

export function RoleTheme({ children }: { children?: React.ReactNode }) {
  // Use consistent initial values for SSR/CSR to prevent hydration mismatch
  const [theme, setThemeState] = useState<Theme>('system');
  const [role, setRoleState] = useState<Role>(null);
  const [mounted, setMounted] = useState(false);

  // Apply theme and role classes
  const applyTheme = useCallback((newTheme: Theme, newRole: Role) => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    
    // Named palettes live on data-theme. Do not clear it for alliance /
    // cofounder / system — those are first-class themes on this line.
    root.classList.remove('dark', 'light');
    if (newTheme === 'minimal' || newTheme === 'apricot') {
      root.classList.add('light');
      root.setAttribute('data-theme', newTheme);
    } else if (newTheme === 'alliance') {
      root.classList.add('light');
      root.setAttribute('data-theme', 'alliance');
    } else if (newTheme === 'cofounder') {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'cofounder');
    } else if (newTheme === 'system') {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.add(systemDark ? 'dark' : 'light');
      root.setAttribute('data-theme', 'system');
    } else {
      root.removeAttribute('data-theme');
      root.classList.add(newTheme);
    }

    // Handle role theme
    roleClasses.forEach((cls) => root.classList.remove(cls));
    if (newRole) {
      root.classList.add(`role-${newRole}`);
    }
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme, role);
  }, [applyTheme, role]);

  const setRole = useCallback((newRole: Role) => {
    setRoleState(newRole);
    applyTheme(theme, newRole);
  }, [applyTheme, theme]);

  // Initialize from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Get stored theme. No saved choice: follow the OS instead of forcing
    // dark on every new user.
    const storedTheme = localStorage.getItem('theme') as Theme | null;
    const initialTheme = storedTheme
      || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setThemeState(initialTheme);

    // Get stored user role
    let initialRole: Role = null;
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const user = JSON.parse(stored) as { role?: string } | null;
        if (user?.role) {
          initialRole = user.role as Role;
          setRoleState(initialRole);
        }
      }
    } catch {
      // ignore invalid stored user
    }

    applyTheme(initialTheme, initialRole);
    setMounted(true);

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (initialTheme === 'system') {
        applyTheme('system', initialRole);
      } else if (!localStorage.getItem('theme')) {
        const next: Theme = mediaQuery.matches ? 'dark' : 'light';
        setThemeState(next);
        applyTheme(next, initialRole);
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [applyTheme]);

  // Listen for storage changes (cross-tab sync)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'user') {
        try {
          if (e.newValue) {
            const user = JSON.parse(e.newValue) as { role?: string };
            setRole(user.role as Role);
          } else {
            setRole(null);
          }
        } catch {
          // ignore
        }
      }
      if (e.key === 'theme') {
        setTheme(
          (e.newValue as Theme)
          || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
        );
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [setRole, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, role, setTheme, setRole }}>
      {children}
    </ThemeContext.Provider>
  );
}
