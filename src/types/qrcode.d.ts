declare module 'qrcode' {
  export interface ToDataUrlOptions {
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
    margin?: number;
    width?: number;
  }

  export function toDataURL(text: string, options?: ToDataUrlOptions): Promise<string>;

  const QRCode: {
    toDataURL: typeof toDataURL;
  };

  export default QRCode;
}
