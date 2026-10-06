"use strict";

let canvas, gl, program;

let positionsArray = [];
let colorsArray = [];

let modelViewMatrixLoc, projectionMatrixLoc;

const BUILDING_WIDTH  = 80.0;
const BUILDING_HEIGHT = 50.0;
const BUILDING_DEPTH  = 65.0;

let eye = vec3(-65.0, -5.0, 70.0);
let at  = vec3(20.0, 38.0, 0.0);
let up  = vec3(0.0, 1.0, 0.0);

let fovy = 65.0;
let aspect;
let near = 1.0;
let far  = 600.0;

window.onload = function init() {
    canvas = document.getElementById("gl-canvas");
    gl = canvas.getContext("webgl2");

    if (!gl) {
        alert("WebGL 2.0 isn't available");
        return;
    }

    gl.viewport(0, 0, canvas.width, canvas.height);
    aspect = canvas.width / canvas.height;

    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.enable(gl.DEPTH_TEST);

    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    buildScene();

    const cBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(colorsArray), gl.STATIC_DRAW);

    const colorLoc = gl.getAttribLocation(program, "aColor");
    gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(colorLoc);

    const vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(positionsArray), gl.STATIC_DRAW);

    const positionLoc = gl.getAttribLocation(program, "aPosition");
    gl.vertexAttribPointer(positionLoc, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(positionLoc);

    modelViewMatrixLoc = gl.getUniformLocation(program, "uModelViewMatrix");
    projectionMatrixLoc = gl.getUniformLocation(program, "uProjectionMatrix");

    render();
};

function quad(a, b, c, d, verts, color) {
    positionsArray.push(verts[a]); colorsArray.push(color);
    positionsArray.push(verts[b]); colorsArray.push(color);
    positionsArray.push(verts[c]); colorsArray.push(color);

    positionsArray.push(verts[a]); colorsArray.push(color);
    positionsArray.push(verts[c]); colorsArray.push(color);
    positionsArray.push(verts[d]); colorsArray.push(color);
}

function box(cx, cy, cz, w, h, d) {
    const x = w / 2.0;
    const y = h / 2.0;
    const z = d / 2.0;

    const v = [
        vec4(cx - x, cy - y, cz + z, 1.0), 
        vec4(cx - x, cy + y, cz + z, 1.0), 
        vec4(cx + x, cy + y, cz + z, 1.0), 
        vec4(cx + x, cy - y, cz + z, 1.0), 
        vec4(cx - x, cy - y, cz - z, 1.0), 
        vec4(cx - x, cy + y, cz - z, 1.0), 
        vec4(cx + x, cy + y, cz - z, 1.0), 
        vec4(cx + x, cy - y, cz - z, 1.0)  
    ];

    const frontColor  = vec4(0.92, 0.92, 0.92, 1.0);
    const rightColor  = vec4(0.78, 0.78, 0.78, 1.0);
    const bottomColor = vec4(0.68, 0.68, 0.68, 1.0);
    const topColor    = vec4(0.96, 0.96, 0.96, 1.0);
    const backColor   = vec4(0.85, 0.85, 0.85, 1.0);
    const leftColor   = vec4(0.88, 0.88, 0.88, 1.0);

    quad(1, 0, 3, 2, v, frontColor);
    quad(2, 3, 7, 6, v, rightColor);
    quad(3, 0, 4, 7, v, bottomColor);
    quad(6, 5, 1, 2, v, topColor);
    quad(4, 5, 6, 7, v, backColor);
    quad(5, 4, 0, 1, v, leftColor);
}

function buildScene() {
    box(
        0.0,
        BUILDING_HEIGHT / 2.0,
        0.0,
        BUILDING_WIDTH,
        BUILDING_HEIGHT,
        BUILDING_DEPTH
    );
}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const modelViewMatrix = lookAt(eye, at, up);
    const projectionMatrix = perspective(fovy, aspect, near, far);

    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(modelViewMatrix));
    gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));

    gl.drawArrays(gl.TRIANGLES, 0, positionsArray.length);
}