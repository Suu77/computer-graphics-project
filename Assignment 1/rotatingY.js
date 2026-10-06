"use strict";

var canvas;
var gl;
var thetaLoc;
var colorLoc;

var colors = [
    vec4(1,0,0,1),
    vec4(0,1,0,1),
    vec4(0,0,1,1),
    vec4(1,1,0,1),
    vec4(1,0,1,1),
    vec4(0,1,1,1)
];

var colorIndex = 0;
var n = 1;
if (n <= 0) n = 1;
var fDelay = 1000 / n;
/* var deltaTheta = Math.PI / (30 * n); old */

//full rotation per min = 2 pi radians / 60s
var omega = 2 * Math.PI / 60.0;
var startTime = 0;
window.onload = function init()
{
    canvas = document.getElementById( "gl-canvas" );

    gl = canvas.getContext('webgl2');
    if (!gl) alert( "WebGL 2.0 isn't available" );

    //
    //  Configure WebGL
    //
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(1.0, 1.0, 1.0, 1.0);

    //  Load shaders and initialize attribute buffers
    var program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    //3 lines, 6 points
    var vertices = [
        vec2(-0.7071, 0.7071), //left
        vec2( 0.0,    0.25),

        vec2( 0.7071, 0.7071), //right
        vec2( 0.0,    0.25),

        vec2( 0.0,    0.25), //bottom
        vec2( 0.0,   -1.0)
    ];

    // Load the data into the GPU
    var bufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW);

    // Associate out shader variables with our data bufferData
    var positionLoc = gl.getAttribLocation(program, "aPosition");
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(positionLoc);

    thetaLoc = gl.getUniformLocation(program, "uTheta");
    colorLoc = gl.getUniformLocation(program, "uColor");
    startTime = performance.now();
    render();
};


function render() {

    gl.clear(gl.COLOR_BUFFER_BIT);
    
    //Part 3 parameter
    var elapsedSeconds = (performance.now() - startTime) / 1000.0;
    var theta = omega * elapsedSeconds;

    gl.uniform1f(thetaLoc, theta);
    gl.uniform4fv(colorLoc, colors[colorIndex]);
    colorIndex = (colorIndex + 1) % colors.length;

    gl.drawArrays(gl.LINES, 0, 6);

    setTimeout(function() {
        requestAnimationFrame(render);
    }, fDelay);
}
