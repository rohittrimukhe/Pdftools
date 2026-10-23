/** Problems a person can act on, with the words to show them. */
export class PdfError extends Error {
  constructor(public readonly code: 'password-required' | 'wrong-password' | 'damaged' | 'not-pdf' | 'bad-range' | 'empty', message: string) {
    super(message);
    this.name = 'PdfError';
  }
}

export const passwordRequired = () => new PdfError('password-required', 'This PDF is protected. Enter its password to continue.');
export const wrongPassword = () => new PdfError('wrong-password', 'That password didn’t open this PDF. Check it and try again.');
export const damaged = () => new PdfError('damaged', 'This PDF looks damaged or incomplete, so it can’t be opened.');
