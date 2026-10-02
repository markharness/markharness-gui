export interface Backend {
  getProjectRoot(): Promise<string>;
}
