"use strict";


let canvas, gl, program;


let positionsArray = [];
let texCoordsArray = [];
let normalsArray = [];
let texture;


let modelViewMatrixLoc, projectionMatrixLoc, normalMatrixLoc;
let ambientProductLoc, diffuseProductLoc, specularProductLoc;
let lightPositionLoc, shininessLoc;


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


const texCoord = [
    vec2(0.0, 0.0),
    vec2(0.0, 8.0),
    vec2(10.0, 8.0),
    vec2(10.0, 0.0)
];


let materialAmbient   = vec4(1.0, 1.0, 1.0, 1.0);
let materialDiffuse   = vec4(1.0, 1.0, 1.0, 1.0);
let materialSpecular  = vec4(0.38, 0.30, 0.20, 1.0);
let materialShininess = 90.0;


let lightPosition;
let lightAmbient;
let lightDiffuse;
let lightSpecular;


window.onload = function init() {
    canvas = document.getElementById("gl-canvas");
    gl = canvas.getContext("webgl2");


    if (!gl) {
        alert("WebGL 2.0 isn't available");
        return;
    }


    gl.viewport(0, 0, canvas.width, canvas.height);
    aspect = canvas.width / canvas.height;


    gl.clearColor(0.92, 0.93, 0.95, 1.0);
    gl.enable(gl.DEPTH_TEST);


    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);


    buildScene();


    const vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(positionsArray), gl.STATIC_DRAW);


    const positionLoc = gl.getAttribLocation(program, "aPosition");
    gl.vertexAttribPointer(positionLoc, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(positionLoc);


    const tBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, tBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(texCoordsArray), gl.STATIC_DRAW);


    const texCoordLoc = gl.getAttribLocation(program, "aTexCoord");
    gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(texCoordLoc);


    const nBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, nBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(normalsArray), gl.STATIC_DRAW);


    const normalLoc = gl.getAttribLocation(program, "aNormal");
    gl.vertexAttribPointer(normalLoc, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(normalLoc);


    modelViewMatrixLoc = gl.getUniformLocation(program, "uModelViewMatrix");
    projectionMatrixLoc = gl.getUniformLocation(program, "uProjectionMatrix");
    normalMatrixLoc = gl.getUniformLocation(program, "uNormalMatrix");


    ambientProductLoc = gl.getUniformLocation(program, "uAmbientProduct");
    diffuseProductLoc = gl.getUniformLocation(program, "uDiffuseProduct");
    specularProductLoc = gl.getUniformLocation(program, "uSpecularProduct");
    lightPositionLoc = gl.getUniformLocation(program, "uLightPosition");
    shininessLoc = gl.getUniformLocation(program, "uShininess");


    gl.uniform1f(shininessLoc, materialShininess);


    document.getElementById("btn10am").onclick = function () {
        setLighting10am();
        document.getElementById("status").textContent = "Current Lighting: 10am";
        render();
    };


    document.getElementById("btn5pm").onclick = function () {
        setLighting5pm();
        document.getElementById("status").textContent = "Current Lighting: 5pm";
        render();
    };


    const image = new Image();
    image.onerror = function () {
        alert("Could not load marble.jpg");
    };
    image.onload = function () {
        configureTexture(image);
        setLighting10am();
        render();
    };
    image.src = "marble.jpg";
};


function quad(a, b, c, d, verts, normal) {
    positionsArray.push(verts[a]); texCoordsArray.push(texCoord[0]); normalsArray.push(normal);
    positionsArray.push(verts[b]); texCoordsArray.push(texCoord[1]); normalsArray.push(normal);
    positionsArray.push(verts[c]); texCoordsArray.push(texCoord[2]); normalsArray.push(normal);


    positionsArray.push(verts[a]); texCoordsArray.push(texCoord[0]); normalsArray.push(normal);
    positionsArray.push(verts[c]); texCoordsArray.push(texCoord[2]); normalsArray.push(normal);
    positionsArray.push(verts[d]); texCoordsArray.push(texCoord[3]); normalsArray.push(normal);
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
    quad(1, 0, 3, 2, v, vec3(0.0, 0.0, 1.0));  
    quad(2, 3, 7, 6, v, vec3(1.0, 0.0, 0.0));   
    quad(3, 0, 4, 7, v, vec3(0.0, -1.0, 0.0));  
    quad(6, 5, 1, 2, v, vec3(0.0, 1.0, 0.0));   
    quad(4, 5, 6, 7, v, vec3(0.0, 0.0, -1.0));  
    quad(5, 4, 0, 1, v, vec3(-1.0, 0.0, 0.0));  
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


function configureTexture(image) {
    texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);


    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);


    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image
    );


    gl.generateMipmap(gl.TEXTURE_2D);


    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);


    gl.uniform1i(gl.getUniformLocation(program, "uTexture"), 0);
}


function applyLighting() {
    const ambientProduct  = mult(lightAmbient, materialAmbient);
    const diffuseProduct  = mult(lightDiffuse, materialDiffuse);
    const specularProduct = mult(lightSpecular, materialSpecular);


    gl.uniform4fv(ambientProductLoc, flatten(ambientProduct));
    gl.uniform4fv(diffuseProductLoc, flatten(diffuseProduct));
    gl.uniform4fv(specularProductLoc, flatten(specularProduct));
    gl.uniform4fv(lightPositionLoc, flatten(lightPosition));
    gl.uniform1f(shininessLoc, materialShininess);
}


function setLighting10am() {
    lightPosition = vec4(-120.0, 115.0, 85.0, 1.0);
    lightAmbient  = vec4(0.34, 0.28, 0.18, 1.0);
    lightDiffuse  = vec4(1.00, 0.88, 0.32, 1.0);
    lightSpecular = vec4(1.00, 0.92, 0.65, 1.0);

    materialShininess = 42.0;
    applyLighting();
}

function setLighting5pm() {
    lightPosition = vec4(135.0, 62.0, 70.0, 1.0);
    lightAmbient  = vec4(0.30, 0.20, 0.14, 1.0);
    lightDiffuse  = vec4(0.92, 0.56, 0.26, 1.0);
    lightSpecular = vec4(0.98, 0.62, 0.34, 1.0);

    materialShininess = 24.0;
    applyLighting();
}


function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);


    const modelViewMatrix = lookAt(eye, at, up);
    const projectionMatrix = perspective(fovy, aspect, near, far);
    const nMatrix = normalMatrix(modelViewMatrix, true);


    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(modelViewMatrix));
    gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));
    gl.uniformMatrix3fv(normalMatrixLoc, false, flatten(nMatrix));


    gl.drawArrays(gl.TRIANGLES, 0, positionsArray.length);
}
