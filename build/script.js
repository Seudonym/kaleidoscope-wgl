"use strict";
main();
function main() {
    const canvas = document.getElementById("canvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
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
    precision highp float; 

    uniform vec2 resolution;
    uniform int iterations;
    uniform float zoom;
    uniform vec2 center;

    
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
      vec4 color = vec4(mandelbrot(uv / zoom + center), 1.0);
      float absx = abs(uv.x);
      float absy = abs(uv.y);
      // Crosshair
      if ((absx < 0.002 && absy < 0.02) || (absy < 0.002 && absx < 0.02)) {
        color = vec4(1.0, 0.0, 0.0, 1.0);
      }

      gl_FragColor = color;
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
            zoom: gl.getUniformLocation(shaderProgram, "zoom"),
            center: gl.getUniformLocation(shaderProgram, "center"),
        },
    };
    const uniforms = {
        resolution: [canvas.width, canvas.height],
        iterations: 100,
        zoom: 1.0,
        center: [0.0, 0.0],
    };
    const vbo = initVBO(gl);
    document.addEventListener("wheel", (e) => {
        e.preventDefault();
        uniforms.zoom *= e.deltaY > 0 ? 1.05 : 1 / 1.05;
        render(gl, vbo, programInfo, uniforms);
    });
    let held = false;
    document.addEventListener("mousemove", (e) => {
        if (!held)
            return;
        console.log(e.movementX, e.movementY);
        const x = canvas.width / canvas.height * (e.movementX / canvas.width);
        const y = (e.movementY / canvas.height);
        uniforms.center[0] -= x / uniforms.zoom;
        uniforms.center[1] += y / uniforms.zoom;
        render(gl, vbo, programInfo, uniforms);
    });
    document.addEventListener("mousedown", (e) => {
        held = true;
    });
    document.addEventListener("mouseup", (e) => {
        held = false;
    });
    render(gl, vbo, programInfo, uniforms);
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
function render(gl, vbo, programInfo, uniforms) {
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.useProgram(programInfo.program);
    gl.vertexAttribPointer(programInfo.attribLocations.position, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(programInfo.attribLocations.position);
    gl.uniform2f(programInfo.uniformLocations.resolution, programInfo.canvas.width, programInfo.canvas.height);
    gl.uniform1i(programInfo.uniformLocations.iterations, 100);
    gl.uniform1f(programInfo.uniformLocations.zoom, uniforms.zoom);
    gl.uniform2f(programInfo.uniformLocations.center, uniforms.center[0], uniforms.center[1]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
