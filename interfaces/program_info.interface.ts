export interface ProgramInfo {
  canvas: HTMLCanvasElement,
  program: WebGLProgram,
  guiControllers: dat.GUIController[],
  uniforms: any,
  attribLocations: any,
  uniformLocations: any,
  updateUniforms(): void;
  initGUI(gui: dat.GUI): void,
  deleteGUI(gui: dat.GUI): void,
}
