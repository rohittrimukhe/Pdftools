// mammoth's browser build has no type declarations; only the call Happy PDF uses is described.
declare module 'mammoth/mammoth.browser.js' {
  interface Message { type: 'warning' | 'error'; message: string }
  const mammoth: {
    convertToHtml(input: { arrayBuffer: ArrayBuffer }, options?: { styleMap?: string[] }): Promise<{ value: string; messages: Message[] }>;
  };
  export default mammoth;
}
