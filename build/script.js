"use strict";
main();
function main() {
    const canvas = document.getElementById("canvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const gl = canvas.getContext("webgl");
    if (!gl) {
        throw new Error("WebGL not supported");
        return;
    }
    const vertexShaderSource = `
    attribute vec2 position;

    void main() {
      gl_Position = vec4(position, 0, 1);
    }
  `;
    const fragmentShaderSource = `
    precision mediump float; 

    uniform vec2 resolution;
    uniform int iterations;
    
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
    
      float v = pow(1.0 - sn, 4.0);
    
      return vec3(v);
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / resolution.xy - vec2(0.5);
      uv *= 2.0 * vec2(resolution.x / resolution.y, 1.0);
      vec3 color = mandelbrot(uv);
      gl_FragColor = vec4(color, 1);
    }
  `;
    const shaderProgram = createShaderProgram(gl, vertexShaderSource, fragmentShaderSource);
    const programInfo = {
        canvas: canvas,
        program: shaderProgram,
        attribLocations: {
            position: gl.getAttribLocation(shaderProgram, "position"),
        },
        uniformLocations: {
            resolution: gl.getUniformLocation(shaderProgram, "resolution"),
            iterations: gl.getUniformLocation(shaderProgram, "iterations"),
        },
    };
    const vbo = initVBO(gl);
    render(gl, vbo, programInfo);
}
function createShaderProgram(gl, vertexShaderSource, fragmentShaderSource) {
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    if (!vertexShader) {
        throw new Error("Vertex shader creation failed");
    }
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        throw new Error("Vertex shader compilation failed: " + gl.getShaderInfoLog(vertexShader));
    }
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fragmentShader) {
        throw new Error("Fragment shader creation failed");
    }
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        throw new Error("Fragment shader compilation failed: " +
            gl.getShaderInfoLog(fragmentShader));
    }
    const program = gl.createProgram();
    if (!program) {
        throw new Error("Program creation failed");
    }
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error("Program linking failed: " + gl.getProgramInfoLog(program));
    }
    return program;
}
function initVBO(gl) {
    const vbo = gl.createBuffer();
    if (!vbo) {
        throw new Error("VBO creation failed");
    }
    const vertices = [-1.0, -1.0, -1.0, +1.0, +1.0, -1.0, 1.0, 1.0];
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return vbo;
}
function render(gl, vbo, programInfo) {
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.useProgram(programInfo.program);
    gl.vertexAttribPointer(programInfo.attribLocations.position, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(programInfo.attribLocations.position);
    gl.uniform2f(programInfo.uniformLocations.resolution, programInfo.canvas.width, programInfo.canvas.height);
    gl.uniform1i(programInfo.uniformLocations.iterations, 100);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
