type AnalyticsValue = string | number | boolean | null | undefined;
type AnalyticsPayload = Record<string, AnalyticsValue>;

interface BrowserWithAnalytics extends Window {
  dataLayer?: Array<Record<string, unknown>>;
  gtag?: (command: "event", eventName: string, params?: Record<string, unknown>) => void;
}

export const trackAnalyticsEvent = (eventName: string, payload: AnalyticsPayload = {}): void => {
  if (typeof window === "undefined") {
    return;
  }

  const browser = window as BrowserWithAnalytics;
  const eventPayload = {
    event: eventName,
    eventName,
    ...payload,
    timestamp: new Date().toISOString(),
  };

  if (Array.isArray(browser.dataLayer)) {
    browser.dataLayer.push(eventPayload);
  }

  if (typeof browser.gtag === "function") {
    browser.gtag("event", eventName, payload);
  }

  window.dispatchEvent(
    new CustomEvent("meomul:analytics", {
      detail: eventPayload,
    }),
  );
};
