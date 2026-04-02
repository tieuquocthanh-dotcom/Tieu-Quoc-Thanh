export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: undefined, // Sẽ được cập nhật từ auth nếu cần
      email: undefined,
      emailVerified: undefined,
      isAnonymous: undefined,
      tenantId: undefined,
      providerInfo: []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  
  // Dispatch custom event for UI to catch
  window.dispatchEvent(new CustomEvent('app-error', { 
    detail: { 
      message: `Lỗi Firestore (${operationType}): ${errInfo.error}`, 
      type: 'error',
      details: errInfo
    } 
  }));

  throw new Error(JSON.stringify(errInfo));
}

export const notifyError = (message: string, details?: string) => {
  console.error("Error:", message, details);
  window.dispatchEvent(new CustomEvent('app-error', { 
    detail: { message, type: 'error', details } 
  }));
};

export const notifySuccess = (message: string) => {
  console.log("Success:", message);
  window.dispatchEvent(new CustomEvent('app-error', { 
    detail: { message, type: 'success' } 
  }));
};
