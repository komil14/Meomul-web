import { useEffect, useState } from "react";

const getIsPageVisible = (): boolean => {
  if (typeof document === "undefined") {
    return true;
  }

  const isVisible = document.visibilityState === "visible";
  if (typeof window === "undefined") {
    return isVisible;
  }

  return isVisible && document.hasFocus();
};

export function usePageVisible(): boolean {
  const [isPageVisible, setIsPageVisible] = useState<boolean>(getIsPageVisible);

  useEffect(() => {
    const updateVisibility = (): void => {
      setIsPageVisible(getIsPageVisible());
    };

    document.addEventListener("visibilitychange", updateVisibility);
    window.addEventListener("focus", updateVisibility);
    window.addEventListener("blur", updateVisibility);

    return () => {
      document.removeEventListener("visibilitychange", updateVisibility);
      window.removeEventListener("focus", updateVisibility);
      window.removeEventListener("blur", updateVisibility);
    };
  }, []);

  return isPageVisible;
}
