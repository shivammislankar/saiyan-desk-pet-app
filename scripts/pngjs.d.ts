declare module "pngjs" {
  export class PNG {
    constructor(options?: { width?: number; height?: number });
    width: number;
    height: number;
    data: Buffer;
    static sync: {
      read(data: Buffer): PNG;
      write(png: PNG): Buffer;
    };
    static bitblt(
      src: PNG,
      dst: PNG,
      sx: number,
      sy: number,
      w: number,
      h: number,
      dx: number,
      dy: number
    ): void;
  }
}
