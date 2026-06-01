export class VegaPaperError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = "VegaPaperError";
    this.exitCode = exitCode;
  }
}
