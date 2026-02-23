import { getErrorMessage } from "@/lib/utils/error";

interface ToastApi {
  error: (message: string) => void;
}

interface MutationErrorOptions {
  prefix?: string;
}

export const showMutationError = (toast: ToastApi, error: unknown, options?: MutationErrorOptions): void => {
  const message = getErrorMessage(error);
  const normalizedMessage = options?.prefix ? `${options.prefix}: ${message}` : message;
  toast.error(normalizedMessage);
};
