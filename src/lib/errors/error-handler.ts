export type HandledApiError = {
  message: string;
  detailId?: string;
  redirectTo?: string;
};

type ErrorRecord = {
  code?: unknown;
  message?: unknown;
};

function isErrorRecord(error: unknown): error is ErrorRecord {
  return typeof error === "object" && error !== null;
}

function getErrorCode(error: unknown) {
  return isErrorRecord(error) && typeof error.code === "string" ? error.code : undefined;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (isErrorRecord(error) && typeof error.message === "string") {
    return error.message;
  }

  return String(error);
}

export function handleApiError(error: unknown): HandledApiError {
  const code = getErrorCode(error);
  const message = getErrorMessage(error);
  const lower = message.toLowerCase();

  if (code === "PGRST205" || lower.includes("could not find the table")) {
    return {
      message: "데이터베이스 테이블을 찾을 수 없습니다.",
      detailId: "Supabase 마이그레이션 적용 상태를 확인하세요.",
    };
  }

  if (lower.includes("jwt") || lower.includes("auth")) {
    return {
      message: "로그인이 만료되었습니다.",
      redirectTo: "/login",
    };
  }

  if (code === "42501" || lower.includes("permission") || lower.includes("403")) {
    return {
      message: "이 작업을 수행할 권한이 없습니다.",
      redirectTo: "/dashboard",
    };
  }

  if (lower.includes("network") || lower.includes("fetch")) {
    return {
      message: "연결이 불안정합니다.",
    };
  }

  return {
    message: message || "작업을 처리하지 못했습니다.",
  };
}
