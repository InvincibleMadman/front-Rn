import { useEffect } from "react";
import { useUiStore } from "@/stores/ui-store";

const darkThemeOverrides: Record<string, string> = {
  "--primary": "261 41% 63%",
  "--primary-soft": "261 28% 26%",
  "--accent-blue": "261 41% 63%",
  "--accent-blue-light": "261 28% 26%",
  "--accent-blue-hover": "261 47% 69%",
  "--color-info": "261 41% 63%",
  // Keep the interaction glow brighter and more purple-pink than the colder button tone.
  "--ring": "261 46% 84%",
};

export function useThemeSync(): void {
  const theme = useUiStore((state) => state.theme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");

    if (theme === "dark") {
      Object.entries(darkThemeOverrides).forEach(([key, value]) => {
        root.style.setProperty(key, value);
      });
      return;
    }

    Object.keys(darkThemeOverrides).forEach((key) => {
      root.style.removeProperty(key);
    });
  }, [theme]);
}
