import * as dat from "dat.gui";
import { ProgramInfo } from "./interfaces/program_info.interface";
import { createShaderProgram, initVBO, render } from "./utils";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
let controls = true;
let held = false;
let currentProgramInfo: ProgramInfo;
let programInfos: ProgramInfo[] = [];

const config = {
  zoomSensitivity: 1.1,
  movementSensitivity: 1.5
}

main();

function main() {
  canvas.width = window.devicePixelRatio * window.innerWidth;
  canvas.height = window.devicePixelRatio * window.innerHeight;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;

  let aspect = canvas.width / canvas.height;

  const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true }) as WebGL2RenderingContext;
  if (!gl) {
    throw new Error("WebGL not supported");
    return;
  }

  const gui = new dat.GUI({ autoPlace: false });
  gui.domElement.id = "gui";
  const gui_container = document.getElementById("gui-container");
  gui_container?.appendChild(gui.domElement);

  

  const vertexShaderSource =
    `#version 300 es
    layout (location=0) in vec2 position;

    void main() {
      gl_Position = vec4(position, 0, 1);
    }
  `;

  const smoothColorShaderSource =
    `#version 300 es
    precision highp float; 
    out vec4 FragColor;

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
    uniform float contrast;
    uniform float brightness;

    vec3 palette[5];
    
    vec3 tone(vec3 x, float c, float b) {
      vec3 col = vec3(0.5) + (x - vec3(0.5)) * c + b;
      return clamp(col, 0.0, 1.0);
    }

    vec3 mandelbrot(vec2 uv) {
      const float radius = 4.0;
    
      vec2 c = uv;
      vec2 z = c;
      int iter = 0;

      for (iter = 0; iter < iterations; iter++) {
        z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
        if (dot(z, z) > radius * radius) { break; }
      }
      float sn = float(iter) - log2(log2(dot(z, z))) + 4.0;
      sn = sn / float(iterations);
    
      float v = pow(1.0 - sn, power);
      float pindex = v * 4.0;

      vec3 c1, c2;
      c1 = palette[int(pindex)];
      c2 = palette[int(pindex) + 1];

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
      color.rgb = pow(tone(color.rgb, contrast, brightness), vec3(1.0 / gamma));
      FragColor = color;
    }
  `;

  const stripeColorShaderSource = `#version 300 es
    precision highp float; 
    out vec4 FragColor;

    uniform vec2 resolution;
    uniform int iterations;
    uniform float zoom;
    uniform vec2 center;
    uniform float gamma;
    uniform float power;
    uniform float contrast;
    uniform float brightness;
    uniform float x1;
    uniform float x2;
    uniform float x3;

    vec3 palette[5];
    
    float tone(float x, float c, float b) {
      float col = 0.5 + (x - 0.5) * c + b;
      return clamp(col, 0.0, 1.0);
    }

    vec3 mandelbrot(vec2 uv) {
      vec2 c = uv;
      vec2 z = c;

      vec2 lastZ;
      float avg, lastAdded, stripeDensity, skip, count, radius, iter;

      avg = lastAdded = skip = count = iter = 0.0;
      radius = 10000.0;
      stripeDensity = 2.0;

      while (iter < float(iterations)) {
        z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;

        if (iter >= skip) {
          count += 1.0;
          lastAdded = 0.5 + 0.5 * sin(stripeDensity * atan(z.y, z.x));
          avg += lastAdded;
        }

        if (dot(z, z) > radius * radius && iter > skip) break;
        lastZ = z;
        iter += 1.0;
      }

      float prevAvg = (avg - lastAdded) / (count - 1.0);
      avg = avg / count;
      float frac = 1.0 + log2((log(radius * radius) / log(dot(z, z))));
      float final = frac * avg + (1.0 - frac) * prevAvg; 
      if (iter >= float(iterations)) final = 0.0;

      // float sn = float(iter) - log2(log2(dot(z, z))) + 4.0;
      // sn = sn / float(iterations);
    
      // float v = pow(1.0 - sn, power);
      // float pindex = v * 4.0;

      // vec3 c1, c2;
      // c1 = palette[int(pindex)];
      // c2 = palette[int(pindex) + 1];
      // float f = fract(pindex);  

      float r = tone(0.5 + 0.5 * cos(final * 3.14 * x1), contrast, brightness);
      float g = tone(0.5 + 0.5 * cos(final * 3.14 * x2), contrast, brightness);
      float b = tone(0.5 + 0.5 * cos(final * 3.14 * x3), contrast, brightness);
      return final == 0.0 ? vec3(0.0) : vec3(r, g, b);
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / resolution.xy - vec2(0.5);
      uv *= 2.0 * vec2(resolution.x / resolution.y, 1.0);
      
      vec4 color = vec4(mandelbrot(uv / zoom + center), 1.0);
      color.rgb = pow(color.rgb, vec3(1.0 / gamma));
      FragColor = color;
    }
  `

  const stripeColorProgram = createShaderProgram(gl, vertexShaderSource, stripeColorShaderSource);
  const smoothColorProgram = createShaderProgram(gl, vertexShaderSource, smoothColorShaderSource);

  const smoothColorProgramInfo: ProgramInfo = {
    canvas: canvas,
    program: smoothColorProgram,
    guiControllers: [],
    uniforms: {
      resolution: [canvas.width, canvas.height],
      iterations: 100,
      zoom: 0.5,
      center: [0.0, 0.0],
      color1: [0.0, 150.0, 255.0],
      color2: [0.0, 44.0, 255.0],
      color3: [103.0, 0.0, 0.0],
      color4: [0.0, 0.0, 0.0],
      gamma: 1.0,
      power: 4.0,
      contrast: 1.0,
      brightness: 0.0
    },
    attribLocations: {
      position: gl.getAttribLocation(smoothColorProgram, "position"),
    },
    uniformLocations: {
      resolution: gl.getUniformLocation(smoothColorProgram, "resolution"),
      iterations: gl.getUniformLocation(smoothColorProgram, "iterations"),
      zoom: gl.getUniformLocation(smoothColorProgram, "zoom"),
      center: gl.getUniformLocation(smoothColorProgram, "center"),
      gamma: gl.getUniformLocation(smoothColorProgram, "gamma"),
      power: gl.getUniformLocation(smoothColorProgram, "power"),
      contrast: gl.getUniformLocation(smoothColorProgram, "contrast"),
      brightness: gl.getUniformLocation(smoothColorProgram, "brightness"),
      color1: gl.getUniformLocation(smoothColorProgram, "color1"),
      color2: gl.getUniformLocation(smoothColorProgram, "color2"),
      color3: gl.getUniformLocation(smoothColorProgram, "color3"),
      color4: gl.getUniformLocation(smoothColorProgram, "color4"),
    },
    updateUniforms() {
      gl.uniform2f(this.uniformLocations.resolution, this.canvas.width, this.canvas.height);
      gl.uniform1i(this.uniformLocations.iterations, this.uniforms.iterations);
      gl.uniform1f(this.uniformLocations.zoom, this.uniforms.zoom);
      gl.uniform2f(this.uniformLocations.center, this.uniforms.center[0], this.uniforms.center[1]);
      gl.uniform1f(this.uniformLocations.gamma, this.uniforms.gamma);
      gl.uniform1f(this.uniformLocations.power, this.uniforms.power);
      gl.uniform1f(this.uniformLocations.contrast, this.uniforms.contrast);
      gl.uniform1f(this.uniformLocations.brightness, this.uniforms.brightness);
      gl.uniform3f(this.uniformLocations.color1, this.uniforms.color1[0] / 255.0, this.uniforms.color1[1] / 255.0, this.uniforms.color1[2] / 255.0);
      gl.uniform3f(this.uniformLocations.color2, this.uniforms.color2[0] / 255.0, this.uniforms.color2[1] / 255.0, this.uniforms.color2[2] / 255.0);
      gl.uniform3f(this.uniformLocations.color3, this.uniforms.color3[0] / 255.0, this.uniforms.color3[1] / 255.0, this.uniforms.color3[2] / 255.0);
      gl.uniform3f(this.uniformLocations.color4, this.uniforms.color4[0] / 255.0, this.uniforms.color4[1] / 255.0, this.uniforms.color4[2] / 255.0);
    },

    initGUI(gui: dat.GUI) {
      const color1Controller = gui.addColor(this.uniforms, "color1");
      const color2Controller = gui.addColor(this.uniforms, "color2");
      const color3Controller = gui.addColor(this.uniforms, "color3");
      const color4Controller = gui.addColor(this.uniforms, "color4");
      const iterationsController = gui.add(this.uniforms, "iterations", 1, 1000, 1);
      const gammaController = gui.add(this.uniforms, "gamma", 0.0, 4.0, 0.1);
      const powerController = gui.add(this.uniforms, "power", 0.0, 10.0, 0.1);
      const contrastController = gui.add(this.uniforms, "contrast", 1.0, 10.0);
      const brightnessController = gui.add(this.uniforms, "brightness", 0.0, 1.0);
      const zoomSensitivityController = gui.add(config, "zoomSensitivity", 1.01, 1.2, 0.01);
      const movementSensitivityController = gui.add(config, "movementSensitivity", 0.1, 3.0, 0.1);

      this.guiControllers = [color1Controller, color2Controller, color3Controller, color4Controller, iterationsController, gammaController, powerController, contrastController, brightnessController, zoomSensitivityController, movementSensitivityController];
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

  const stripeColorProgramInfo: ProgramInfo = {
    canvas: canvas,
    program: stripeColorProgram,
    guiControllers: [],
    uniforms: {
      resolution: [canvas.width, canvas.height],
      iterations: 100,
      zoom: 0.5,
      center: [0.0, 0.0],
      gamma: 1.0,
      power: 4.0,
      contrast: 1.0,
      brightness: 0.0,
      x1: 1.0,
      x2: 1.0,
      x3: 1.0,
    },
    attribLocations: {
      position: gl.getAttribLocation(stripeColorProgram, "position"),
    },
    uniformLocations: {
      resolution: gl.getUniformLocation(stripeColorProgram, "resolution"),
      iterations: gl.getUniformLocation(stripeColorProgram, "iterations"),
      zoom: gl.getUniformLocation(stripeColorProgram, "zoom"),
      center: gl.getUniformLocation(stripeColorProgram, "center"),
      gamma: gl.getUniformLocation(stripeColorProgram, "gamma"),
      power: gl.getUniformLocation(stripeColorProgram, "power"),
      contrast: gl.getUniformLocation(stripeColorProgram, "contrast"),
      brightness: gl.getUniformLocation(stripeColorProgram, "brightness"),
      x1: gl.getUniformLocation(stripeColorProgram, "x1"),
      x2: gl.getUniformLocation(stripeColorProgram, "x2"),
      x3: gl.getUniformLocation(stripeColorProgram, "x3"),
    },
    updateUniforms() {
      gl.uniform2f(this.uniformLocations.resolution, this.canvas.width, this.canvas.height);
      gl.uniform1i(this.uniformLocations.iterations, this.uniforms.iterations);
      gl.uniform1f(this.uniformLocations.zoom, this.uniforms.zoom);
      gl.uniform2f(this.uniformLocations.center, this.uniforms.center[0], this.uniforms.center[1]);
      gl.uniform1f(this.uniformLocations.x1, this.uniforms.x1);
      gl.uniform1f(this.uniformLocations.x2, this.uniforms.x2);
      gl.uniform1f(this.uniformLocations.x3, this.uniforms.x3);
      gl.uniform1f(this.uniformLocations.gamma, this.uniforms.gamma);
      gl.uniform1f(this.uniformLocations.contrast, this.uniforms.contrast);
      gl.uniform1f(this.uniformLocations.brightness, this.uniforms.brightness);
    },

    initGUI(gui: dat.GUI) {
      const iterationsController = gui.add(this.uniforms, "iterations", 1, 1000, 1);
      const gammaController = gui.add(this.uniforms, "gamma", 0.0, 4.0, 0.1);
      const contrastController = gui.add(this.uniforms, "contrast", 1.0, 10.0);
      const brightnessController = gui.add(this.uniforms, "brightness", 0.0, 1.0, 0.1);
      const x1Controller = gui.add(this.uniforms, "x1", 0.0, 10.0);
      const x2Controller = gui.add(this.uniforms, "x2", 0.0, 10.0);
      const x3Controller = gui.add(this.uniforms, "x3", 0.0, 10.0);
      const zoomSensitivityController = gui.add(config, "zoomSensitivity", 1.01, 1.2, 0.01);
      const movementSensitivityController = gui.add(config, "movementSensitivity", 0.1, 3.0, 0.1);

      this.guiControllers = [x1Controller, x2Controller, x3Controller, iterationsController, gammaController, zoomSensitivityController, movementSensitivityController, contrastController, brightnessController];
      this.guiControllers.forEach((controller, i) => {
        controller.onChange(() => { controls = false; render(gl, vbo, stripeColorProgramInfo); });
        controller.onFinishChange(() => { controls = true; });
      });
    },

    deleteGUI(gui: dat.GUI) {
      this.guiControllers.forEach((controller, i) => {
        gui.remove(controller);
      });
    },
  };

  programInfos.push(smoothColorProgramInfo);
  programInfos.push(stripeColorProgramInfo);
  currentProgramInfo = stripeColorProgramInfo;

  const vbo = initVBO(gl);
  initCoreListeners(gl, vbo);
  initCoreGUI(gl, vbo, gui);
  currentProgramInfo.initGUI(gui);

  render(gl, vbo, currentProgramInfo);
}

function initCoreListeners(gl: WebGL2RenderingContext, vbo: WebGLBuffer) {
  document.addEventListener("wheel", (e) => {
    e.preventDefault();
    currentProgramInfo.uniforms.zoom *= e.deltaY > 0 ? config.zoomSensitivity : 1 / config.zoomSensitivity;
    render(gl, vbo, currentProgramInfo);
  });

  document.addEventListener("mousemove", (e) => {
    if (!controls) return;
    if (!held) return;
    const x = canvas.width / canvas.height * (e.movementX / canvas.width);
    const y = (e.movementY / canvas.height);

    currentProgramInfo.uniforms.center[0] -= config.movementSensitivity * x / currentProgramInfo.uniforms.zoom;
    currentProgramInfo.uniforms.center[1] += config.movementSensitivity * y / currentProgramInfo.uniforms.zoom;
    render(gl, vbo, currentProgramInfo);
  });

  document.addEventListener("mousedown", (e) => { held = true; });
  document.addEventListener("mouseup", (e) => { held = false; });

  // TODO: Implement proper canvas resizing
  window.addEventListener("resize", (e) => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    currentProgramInfo.uniforms.resolution = [canvas.width, canvas.height];
    render(gl, vbo, currentProgramInfo);
  });

  // TODO: Implement proper canvas resizing for fullscreen
}

function initCoreGUI(gl: WebGL2RenderingContext, vbo: WebGLBuffer, gui: dat.GUI) {
  let screenshot = function () {
    const link = document.createElement("a");
    link.download = "screenshot.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };
  const screenshotController = gui.add({ screenshot }, "screenshot");

  let reset = function () {
    currentProgramInfo.uniforms.center = [0.0, 0.0];
    currentProgramInfo.uniforms.zoom = 0.5;
    render(gl, vbo, currentProgramInfo);
  };
  const resetController = gui.add({ reset }, "reset");

  let switchProgram = function () {
    currentProgramInfo.deleteGUI(gui);
    let nextProgram = programInfos[(programInfos.indexOf(currentProgramInfo) + 1) % programInfos.length];
    nextProgram.uniforms.center = currentProgramInfo.uniforms.center;
    nextProgram.uniforms.zoom = currentProgramInfo.uniforms.zoom;

    currentProgramInfo = nextProgram;
    currentProgramInfo.initGUI(gui);
    render(gl, vbo, currentProgramInfo);
  }
  const switchProgramController = gui.add({ switchProgram }, "switchProgram");
}