import { toast } from "sonner";

import { handleApiError } from "./error-handler";

export function showSuccess(message: string) {
  toast.success(message, { duration: 3_000 });
}

export function showInfo(message: string) {
  toast.info(message, { duration: 4_000 });
}

export function showWarning(message: string) {
  toast.warning(message, { duration: 5_000 });
}

export function showError(error: unknown) {
  const handled = handleApiError(error);

  toast.error(handled.message, {
    duration: 8_000,
    description: handled.detailId,
  });

  return handled;
}
