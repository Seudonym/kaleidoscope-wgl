import * as dat from "dat.gui";
import { ProgramInfo } from "./interfaces/program_info.interface";
import { createShaderProgram, initVBO, render } from "./utils";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
let controls = true;
let held = false;
let currentProgram: WebGLProgram;
let currentProgramInfo: ProgramInfo;

const uniforms = {
  resolution: [canvas.width, canvas.height],
  iterations: 100,
  zoom: 0.5,
  center: [0.0, 0.0],
  color1: [0.0, 150.0, 255.0],
  color2: [0.0, 44.0, 255.0],
  color3: [103.0, 0.0, 0.0],
  color4: [0.0, 0.0, 0.0],
  gamma: 1.0,
  power: 4.0
};

const config = {
  zoomSensitivity: 1.1,
  movementSensitivity: 1.5
}


main();

function main() {
  // Init
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  let aspect = canvas.width / canvas.height;

  const gl = canvas.getContext("experimental-webgl", { preserveDrawingBuffer: true }) as WebGLRenderingContext;
  if (!gl) {
    throw new Error("WebGL not supported");
    return;
  }

  const gui = new dat.GUI({ autoPlace: false });
  gui.domElement.id = "gui";
  const gui_container = document.getElementById("gui-container");
  gui_container?.appendChild(gui.domElement);

  // Shader program init
  const vertexShaderSource = `
    attribute vec2 position;

    void main() {
      gl_Position = vec4(position, 0, 1);
    }
  `;

  const smoothColorShaderSource = `
    precision highp float; 

    uniform vec2 resolution;
    uniform int iterations;
    uniform float zoom;
    uniform vec2 center;

    uniform vec3 color1;
    uniform vec3 color2;
    uniform vec3 color3;
    uniform vec3 color4;
    uniform float gamma;
    uniform float power;

    vec3 palette[5];
    
    vec3 mandelbrot(vec2 uv) {
      const float radius = 4.0;
    
      vec2 c = uv;
      vec2 z = c;
      float i = 0.0;
    
      for (int j = 0; j < 1000000; j++) {
        if (j > iterations) { break; }
        z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
        if (dot(z, z) > radius * radius) { break; }
        i += 1.0;
      }
      float sn = i - log2(log2(dot(z, z))) + 4.0;
      sn = sn / float(iterations);
    
      float v = pow(1.0 - sn, power);
      float pindex = v * 4.0;

      vec3 c1, c2;
      // ----------------------------------------------------
      /* Forgive me mother of god but it wont let me index */
      // ----------------------------------------------------
      for (int i = 0; i < 3; i++) {
        if (int(pindex) == 0) {
          c1 = palette[0];
          c2 = palette[1];
        }
        else if (int(pindex) == 1) {
          c1 = palette[1];
          c2 = palette[2];
        }
        else if (int(pindex) == 2) {
          c1 = palette[2];
          c2 = palette[3];
        }
        else if (int(pindex) == 3) {
          c1 = palette[3];
          c2 = palette[4];
        }
      }

      float f = fract(pindex);  
      
      return mix(c1, c2, f);
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / resolution.xy - vec2(0.5);
      uv *= 2.0 * vec2(resolution.x / resolution.y, 1.0);
      
      palette[0] = vec3(0.0);
      palette[1] = color1;
      palette[2] = color2;
      palette[3] = color3;
      palette[4] = color4;

      vec4 color = vec4(mandelbrot(uv / zoom + center), 1.0);
      float absx = abs(uv.x);
      float absy = abs(uv.y);
      // Crosshair
      // if ((absx < 0.002 && absy < 0.02) || (absy < 0.002 && absx < 0.02)) {
        // color = vec4(1.0);
      // }
      color.rgb = pow(color.rgb, vec3(1.0 / gamma));
      gl_FragColor = color;
    }
  `;

  const smoothColorProgram = createShaderProgram(gl, vertexShaderSource, smoothColorShaderSource);
  const smoothColorProgramInfo: ProgramInfo = {
    canvas: canvas,
    program: smoothColorProgram,
    guiControllers: [],
    attribLocations: {
      position: gl.getAttribLocation(smoothColorProgram, "position"),
    },
    uniformLocations: {
      resolution: gl.getUniformLocation(smoothColorProgram, "resolution"),
      iterations: gl.getUniformLocation(smoothColorProgram, "iterations"),
      zoom: gl.getUniformLocation(smoothColorProgram, "zoom"),
      center: gl.getUniformLocation(smoothColorProgram, "center"),
      color1: gl.getUniformLocation(smoothColorProgram, "color1"),
      color2: gl.getUniformLocation(smoothColorProgram, "color2"),
      color3: gl.getUniformLocation(smoothColorProgram, "color3"),
      color4: gl.getUniformLocation(smoothColorProgram, "color4"),
      gamma: gl.getUniformLocation(smoothColorProgram, "gamma"),
      power: gl.getUniformLocation(smoothColorProgram, "power"),
    },
    updateUniforms() {
      gl.uniform2f(this.uniformLocations.resolution, this.canvas.width, this.canvas.height);
      gl.uniform1i(this.uniformLocations.iterations, uniforms.iterations);
      gl.uniform1f(this.uniformLocations.zoom, uniforms.zoom);
      gl.uniform2f(this.uniformLocations.center, uniforms.center[0], uniforms.center[1]);
      gl.uniform3f(this.uniformLocations.color1, uniforms.color1[0] / 255.0, uniforms.color1[1] / 255.0, uniforms.color1[2] / 255.0);
      gl.uniform3f(this.uniformLocations.color2, uniforms.color2[0] / 255.0, uniforms.color2[1] / 255.0, uniforms.color2[2] / 255.0);
      gl.uniform3f(this.uniformLocations.color3, uniforms.color3[0] / 255.0, uniforms.color3[1] / 255.0, uniforms.color3[2] / 255.0);
      gl.uniform3f(this.uniformLocations.color4, uniforms.color4[0] / 255.0, uniforms.color4[1] / 255.0, uniforms.color4[2] / 255.0);
      gl.uniform1f(this.uniformLocations.gamma, uniforms.gamma);
      gl.uniform1f(this.uniformLocations.power, uniforms.power);
    },

    initGUI(gui: dat.GUI) {
      const color1Controller = gui.addColor(uniforms, "color1");
      const color2Controller = gui.addColor(uniforms, "color2");
      const color3Controller = gui.addColor(uniforms, "color3");
      const color4Controller = gui.addColor(uniforms, "color4");
      const iterationsController = gui.add(uniforms, "iterations", 1, 1000, 1);
      const gammaController = gui.add(uniforms, "gamma", 0.0, 4.0, 0.1);
      const powerController = gui.add(uniforms, "power", 0.0, 10.0, 0.1);
      const zoomSensitivityController = gui.add(config, "zoomSensitivity", 1.01, 1.2, 0.01);
      const movementSensitivityController = gui.add(config, "movementSensitivity", 0.1, 3.0, 0.1);

      this.guiControllers = [color1Controller, color2Controller, color3Controller, color4Controller, iterationsController, gammaController, powerController, zoomSensitivityController, movementSensitivityController];
      this.guiControllers.forEach((controller, i) => {
        controller.onChange(() => { controls = false; render(gl, vbo, smoothColorProgramInfo); });
        controller.onFinishChange(() => { controls = true; });
      });
    },

    deleteGUI(gui: dat.GUI) {
      this.guiControllers.forEach((controller, i) => {
        gui.remove(controller);
      });
    },
  };

  currentProgram = smoothColorProgram;
  currentProgramInfo = smoothColorProgramInfo;

  const vbo = initVBO(gl);
  initCoreListeners(gl, vbo);
  currentProgramInfo.initGUI(gui);
  initCoreGUI(gl, vbo, gui);

  render(gl, vbo, smoothColorProgramInfo);
}

function initCoreListeners(gl: WebGLRenderingContext, vbo: WebGLBuffer) {
  document.addEventListener("wheel", (e) => {
    e.preventDefault();
    uniforms.zoom *= e.deltaY > 0 ? config.zoomSensitivity : 1 / config.zoomSensitivity;
    render(gl, vbo, currentProgramInfo);
  });

  document.addEventListener("mousemove", (e) => {
    if (!controls) return;
    if (!held) return;
    const x = canvas.width / canvas.height * (e.movementX / canvas.width);
    const y = (e.movementY / canvas.height);

    uniforms.center[0] -= config.movementSensitivity * x / uniforms.zoom;
    uniforms.center[1] += config.movementSensitivity * y / uniforms.zoom;
    render(gl, vbo, currentProgramInfo);
  });

  document.addEventListener("mousedown", (e) => { held = true; });
  document.addEventListener("mouseup", (e) => { held = false; });

  // TODO: Implement proper canvas resizing
}

function initCoreGUI(gl: WebGLRenderingContext, vbo: WebGLBuffer, gui: dat.GUI) {
  let screenshot = function () {
    const link = document.createElement("a");
    link.download = "screenshot.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };
  const screenshotController = gui.add({ screenshot }, "screenshot");

  let reset = function () {
    uniforms.center = [0.0, 0.0];
    uniforms.zoom = 0.5;
    render(gl, vbo, currentProgramInfo);
  };
  const resetController = gui.add({ reset }, "reset");
}