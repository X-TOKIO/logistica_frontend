import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

type Theme = 'ninos' | 'jovenes' | 'adultos';
type Mode = 'light' | 'dark' | 'auto';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  mode: Mode;
  setMode: (mode: Mode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>('jovenes');
  const [mode, setMode] = useState<Mode>('auto');

  useEffect(() => {
    const root = window.document.documentElement;

    // Reiniciar temas demográficos
    root.classList.remove('theme-ninos', 'theme-jovenes', 'theme-adultos');
    root.classList.add(`theme-${theme}`);

    // Resolver Dark Mode automático
    let isDark = false;
    if (mode === 'auto') {
      const hour = new Date().getHours();
      // Activa modo oscuro entre las 18:00 (PM) y las 06:00 (AM)
      isDark = hour >= 18 || hour < 6;
    } else {
      isDark = mode === 'dark';
    }

    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

  }, [theme, mode]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, mode, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme debe ser usado dentro de un ThemeProvider');
  return context;
};
