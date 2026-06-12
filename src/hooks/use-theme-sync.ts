import { useEffect } from "react";
import { useUiStore } from "@/stores/ui-store";

export function useThemeSync(): void {
  const theme = useUiStore((state) => state.theme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
  }, [theme]);
}
