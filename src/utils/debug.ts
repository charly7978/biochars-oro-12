
export const debugCamera = (message: string, data?: any) => {
  console.log(`[CAMERA] ${message}`, data || '');
};

export const debugFrame = (message: string, data?: any) => {
  console.log(`[FRAME] ${message}`, data || '');
};

export const debugFinger = (message: string, data?: any) => {
  console.log(`[FINGER] ${message}`, data || '');
};

export const debugSignal = (message: string, data?: any) => {
  console.log(`[SIGNAL] ${message}`, data || '');
};
