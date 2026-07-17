declare module 'html5-qrcode' {
  export interface Html5QrcodeCameraScanConfig {
    fps?: number;
    qrbox?:
      | number
      | {
          width: number;
          height: number;
        };
    aspectRatio?: number;
  }

  export interface Html5QrcodeResult {
    decodedText: string;
  }

  export class Html5Qrcode {
    constructor(elementId: string, verbose?: boolean);
    start(
      cameraConfig: { facingMode: 'environment' | 'user' } | string,
      configuration: Html5QrcodeCameraScanConfig | undefined,
      qrCodeSuccessCallback: (decodedText: string, result: Html5QrcodeResult) => void,
      qrCodeErrorCallback?: (errorMessage: string) => void,
    ): Promise<unknown>;
    stop(): Promise<void>;
    clear(): Promise<void>;
    isScanning: boolean;
  }
}
