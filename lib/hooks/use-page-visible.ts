import { useEffect, useState } from "react";

const getIsPageVisible = (): boolean => {
  if (typeof document === "undefined") {
    return true;
  }

  return document.visibilityState === "visible";
};

export function usePageVisible(): boolean {
  const [isPageVisible, setIsPageVisible] = useState<boolean>(getIsPageVisible);

  useEffect(() => {
    const handleVisibilityChange = (): void => {
      setIsPageVisible(getIsPageVisible());
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return isPageVisible;
}
