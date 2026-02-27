import type { SweetAlertOptions } from "sweetalert2";

interface ConfirmActionOptions {
  title: string;
  text?: string;
  confirmText?: string;
  cancelText?: string;
}

interface ConfirmDangerOptions extends ConfirmActionOptions {
  warningText?: string;
}

const BASE_POPUP_CLASSES = {
  popup: "rounded-2xl border border-slate-200 shadow-xl",
  title: "text-xl font-semibold text-slate-900",
  htmlContainer: "text-sm text-slate-600",
  confirmButton:
    "inline-flex items-center justify-center rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400",
  cancelButton:
    "inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300",
};

const loadSwal = async () => {
  const mod = await import("sweetalert2");
  return mod.default;
};

const withBaseOptions = (options: SweetAlertOptions): SweetAlertOptions => ({
  confirmButtonColor: undefined,
  cancelButtonColor: undefined,
  buttonsStyling: false,
  reverseButtons: true,
  heightAuto: false,
  customClass: BASE_POPUP_CLASSES,
  ...options,
});

const fireAlert = async (options: SweetAlertOptions) => {
  const Swal = await loadSwal();
  return Swal.fire(withBaseOptions(options));
};

export const successAlert = async (title: string, text?: string): Promise<void> => {
  await fireAlert({
    icon: "success",
    title,
    text,
    confirmButtonText: "OK",
  });
};

export const errorAlert = async (title: string, text?: string): Promise<void> => {
  await fireAlert({
    icon: "error",
    title,
    text,
    confirmButtonText: "Close",
  });
};

export const infoAlert = async (title: string, text?: string): Promise<void> => {
  await fireAlert({
    icon: "info",
    title,
    text,
    confirmButtonText: "Got it",
  });
};

export const confirmAction = async ({
  title,
  text,
  confirmText = "Confirm",
  cancelText = "Cancel",
}: ConfirmActionOptions): Promise<boolean> => {
  const result = await fireAlert({
    icon: "question",
    title,
    text,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
  });

  return result.isConfirmed;
};

export const confirmDanger = async ({
  title,
  text,
  warningText,
  confirmText = "Yes, continue",
  cancelText = "Cancel",
}: ConfirmDangerOptions): Promise<boolean> => {
  const composedText = warningText ? `${text ? `${text}\n\n` : ""}${warningText}` : text;

  const result = await fireAlert({
    icon: "warning",
    title,
    text: composedText,
    showCancelButton: true,
    focusCancel: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    customClass: {
      ...BASE_POPUP_CLASSES,
      confirmButton:
        "inline-flex items-center justify-center rounded-lg border border-rose-700 bg-rose-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-300",
    },
  });

  return result.isConfirmed;
};
