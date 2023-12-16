export function createShaderProgram(
    gl: WebGLRenderingContext,
    vertexShaderSource: string,
    fragmentShaderSource: string,
) {
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    if (!vertexShader) {
        throw new Error("Vertex shader creation failed");
    }
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);

    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        throw new Error(
            "Vertex shader compilation failed: " + gl.getShaderInfoLog(vertexShader),
        );
    }

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fragmentShader) {
        throw new Error("Fragment shader creation failed");
    }
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);

    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        throw new Error(
            "Fragment shader compilation failed: " +
            gl.getShaderInfoLog(fragmentShader),
        );
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

export function initVBO(gl: WebGLRenderingContext) {
    const vbo = gl.createBuffer();
    if (!vbo) { throw new Error("VBO creation failed"); }
    const vertices = [-1.0, -1.0, -1.0, +1.0, +1.0, -1.0, 1.0, 1.0];
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return vbo;
}

export function render(gl: WebGLRenderingContext, vbo: WebGLBuffer, programInfo: any) {
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.useProgram(programInfo.program);
    gl.vertexAttribPointer(programInfo.attribLocations.position, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(programInfo.attribLocations.position);
    programInfo.updateUniforms();
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
