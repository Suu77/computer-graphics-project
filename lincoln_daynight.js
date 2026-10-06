"use strict";

let canvas, gl, program;

let positionsArray = [];
let normalsArray = [];
let texCoordsArray = [];
let materialArray = [];

let modelViewMatrixLoc, projectionMatrixLoc;
let lightPositionLoc, ambientLoc, diffuseLoc, specularLoc, shininessLoc;
let stoneTexLoc, groundTexLoc, waterTexLoc, cloudTexLoc, nightCloudTexLoc, buildingTexLoc, grassImageTexLoc;
let reflectionLengthLoc, reflectionOpacityLoc;
let waterHighlightLoc, waterHighlightColorLoc;
let shadowOffsetLoc, shadowStrengthLoc;
let texScaleLoc, waterTimeLoc, skyTopLoc, skyBottomLoc;

const MODEL_TOP_URL = "Lincoln_Memorial_TOP v2.stl";
const MODEL_BOT_URL = "Lincoln_Memorial_BOT v3 (1).stl";

let target = vec3(0.0, -0.4, 0.0);
const fixedRadius = 7.2;
const fixedYaw = 0.75;
const fixedPitch = 0.55;
const onePointRadius = 11.5;
const onePointYaw = 0.0;
const onePointPitch = -0.12;

const normalFovy = 44.0;
const curvilinearFovy = 78.0;
let radius = fixedRadius;
let yaw = fixedYaw;
let pitch = fixedPitch;
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
let up = vec3(0.0, 1.0, 0.0);

let fovy = 44.0;
let aspect;
let near = 0.1;
let far = 100.0;
let cameraLocked = true;

const materialAmbient = vec4(0.88, 0.84, 0.76, 1.0);
const materialDiffuse = vec4(1.00, 0.98, 0.92, 1.0);
const materialSpecular = vec4(0.35, 0.35, 0.35, 1.0);
const materialShininess = 32.0;

const MATERIAL_STONE = 0.0;
const MATERIAL_GROUND = 1.0;
const MATERIAL_WATER = 2.0;
const MATERIAL_REFLECTION = 3.0;
const MATERIAL_SHADOW = 4.0;
const MATERIAL_SKY = 5.0;
const MATERIAL_CITY = 6.0;

let hourOfDay = 10.0;
let isPlaying = false;
let previousTime = 0.0;
const daySpeed = 1.5;

function getRawBounds(triangles) {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (const tri of triangles) {
        for (const v of [tri.v1, tri.v2, tri.v3]) {
            minX = Math.min(minX, v[0]);
            minY = Math.min(minY, v[1]);
            minZ = Math.min(minZ, v[2]);

            maxX = Math.max(maxX, v[0]);
            maxY = Math.max(maxY, v[1]);
            maxZ = Math.max(maxZ, v[2]);
        }
    }

    return { minX, minY, minZ, maxX, maxY, maxZ };
}

function moveTriangles(triangles, dx, dy, dz) {
    for (const tri of triangles) {
        for (const v of [tri.v1, tri.v2, tri.v3]) {
            v[0] += dx;
            v[1] += dy;
            v[2] += dz;
        }
    }
}
async function loadSplitModel() {
    const botResponse = await fetch(MODEL_BOT_URL);
    const topResponse = await fetch(MODEL_TOP_URL);

    if (!botResponse.ok) throw new Error("Could not load STL file: " + MODEL_BOT_URL);
    if (!topResponse.ok) throw new Error("Could not load STL file: " + MODEL_TOP_URL);

    const botBuffer = await botResponse.arrayBuffer();
    const topBuffer = await topResponse.arrayBuffer();

    const botTriangles = parseSTL(botBuffer);
    const topTriangles = parseSTL(topBuffer);

    const botBounds = getRawBounds(botTriangles);
    const topBounds = getRawBounds(topTriangles);

    const zOffset = botBounds.maxZ - topBounds.minZ - 10.0;

    moveTriangles(topTriangles, 0.0, 0.0, zOffset);

    const allTriangles = botTriangles.concat(topTriangles);
    const normalized = normalizeTriangles(allTriangles);

    for (const tri of normalized) {
        const normal = normalize3(tri.normal);
        const verts = [tri.v1, tri.v2, tri.v3];

        for (const v of verts) {
            positionsArray.push(vec4(v[0], v[1], v[2], 1.0));
            normalsArray.push(vec3(normal[0], normal[1], normal[2]));
            texCoordsArray.push(vec2(v[0], v[2]));
            materialArray.push(MATERIAL_STONE);
        }
    }
}

window.onload = async function init() {
    try {
        canvas = document.getElementById("gl-canvas");
        gl = canvas.getContext("webgl2");

        if (!gl) {
            alert("WebGL 2.0 is not available");
            return;
        }

        canvas.addEventListener("contextmenu", e => e.preventDefault());
        canvas.addEventListener("wheel", onWheel, { passive: false });
        canvas.addEventListener("mousedown", onMouseDown);
        canvas.addEventListener("mousemove", onMouseMove);
        canvas.addEventListener("mouseup", onMouseUp);
        canvas.addEventListener("mouseleave", onMouseUp);
        gl.viewport(0, 0, canvas.width, canvas.height);
        aspect = canvas.width / canvas.height;

        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        gl.clearColor(0.95, 0.96, 1.0, 1.0);

        program = initShaders(gl, "vertex-shader", "fragment-shader");
        gl.useProgram(program);

        await loadSplitModel();

        addGround();
        addReflectingPool();
        addRealisticWaterReflection();
        addBuildingShadow();
        addSkyPlane();
        addCityBuildings();
        addFrontTreeBushLine();
        
        bindArray("aPosition", positionsArray, 4);
        bindArray("aNormal", normalsArray, 3);
        bindArray("aTexCoord", texCoordsArray, 2);
        bindArray("aMaterial", materialArray, 1);

        modelViewMatrixLoc = gl.getUniformLocation(program, "uModelViewMatrix");
        projectionMatrixLoc = gl.getUniformLocation(program, "uProjectionMatrix");

        lightPositionLoc = gl.getUniformLocation(program, "uLightPosition");
        ambientLoc = gl.getUniformLocation(program, "uAmbientProduct");
        diffuseLoc = gl.getUniformLocation(program, "uDiffuseProduct");
        specularLoc = gl.getUniformLocation(program, "uSpecularProduct");
        shininessLoc = gl.getUniformLocation(program, "uShininess");

        reflectionLengthLoc = gl.getUniformLocation(program, "uReflectionLength");
        reflectionOpacityLoc = gl.getUniformLocation(program, "uReflectionOpacity");
        waterHighlightLoc = gl.getUniformLocation(program, "uWaterHighlight");
        waterHighlightColorLoc = gl.getUniformLocation(program, "uWaterHighlightColor");
        shadowOffsetLoc = gl.getUniformLocation(program, "uShadowOffset");
        shadowStrengthLoc = gl.getUniformLocation(program, "uShadowStrength");

        stoneTexLoc = gl.getUniformLocation(program, "uStoneTexture");
        groundTexLoc = gl.getUniformLocation(program, "uGroundTexture");
        waterTexLoc = gl.getUniformLocation(program, "uWaterTexture");
        cloudTexLoc = gl.getUniformLocation(program, "uCloudTexture");
        texScaleLoc = gl.getUniformLocation(program, "uTexScale");
        waterTimeLoc = gl.getUniformLocation(program, "uWaterTime");
        skyTopLoc = gl.getUniformLocation(program, "uSkyTop");
        skyBottomLoc = gl.getUniformLocation(program, "uSkyBottom");

        const stoneTexture = createStoneTexture(256, 256);
        const groundTexture = createGroundTexture(256, 256);
        const waterTexture = createWaterTexture(256, 256);
        const cloudTexture = await loadImageTexture("sky_texture.jpg");
        const nightCloudTexture = await loadImageTexture("night_sky_texture.jpg");
        const buildingTexture = await loadImageTexture("building_texture.jpg");
        const grassImageTexture = await loadImageTexture("ground_texture.jpg");

        bindTexture(stoneTexture, 0, stoneTexLoc);
        bindTexture(groundTexture, 1, groundTexLoc);
        bindTexture(waterTexture, 2, waterTexLoc);
        bindTexture(cloudTexture, 3, cloudTexLoc);
        nightCloudTexLoc = gl.getUniformLocation(program, "uNightCloudTexture");
        bindTexture(nightCloudTexture, 4, nightCloudTexLoc);
        buildingTexLoc = gl.getUniformLocation(program, "uBuildingTexture");
        bindTexture(buildingTexture, 5, buildingTexLoc);
        grassImageTexLoc = gl.getUniformLocation(program, "uGrassImageTexture");
        bindTexture(grassImageTexture, 7, grassImageTexLoc);

        gl.uniform1f(texScaleLoc, 0.85);

        setupUI();

        requestAnimationFrame(render);
    } catch (err) {
        console.error(err);
        alert("Init failed: " + err.message);
    }
};

function bindArray(name, data, size) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

    if (name === "aMaterial") {
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    } else {
        gl.bufferData(gl.ARRAY_BUFFER, flatten(data), gl.STATIC_DRAW);
    }

    const loc = gl.getAttribLocation(program, name);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(loc);
}

function bindTexture(texture, unit, location) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(location, unit);
}

function setupUI() {
    const playButton = document.getElementById("ToggleSim");
    const lockCameraButton = document.getElementById("LockCamera");
    const onePointButton = document.getElementById("OnePointCamera");
    const orbitNote = document.getElementById("orbitNote");

    if (playButton) {
        playButton.onclick = function () {
            isPlaying = !isPlaying;
            playButton.textContent = isPlaying ? "Pause 24 Hour Light" : "Play 24 Hour Light";
        };
    }

    if (lockCameraButton) {
        lockCameraButton.onclick = function () {
            cameraLocked = true;
            radius = fixedRadius;
            yaw = fixedYaw;
            pitch = fixedPitch;

            if (orbitNote) orbitNote.style.display = "none";
        };
    }

    if (onePointButton) {
        onePointButton.onclick = function () {
            cameraLocked = false;
            radius = onePointRadius;
            yaw = onePointYaw;
            pitch = onePointPitch;

            if (orbitNote) orbitNote.style.display = "inline";
        };
    }
}

function smoothstep(edge0, edge1, x) {
    let t = Math.max(0.0, Math.min(1.0, (x - edge0) / (edge1 - edge0)));
    return t * t * (3.0 - 2.0 * t);
}

function mixVec4(a, b, t) {
    t = Math.max(0.0, Math.min(1.0, t));

    return vec4(
        a[0] * (1.0 - t) + b[0] * t,
        a[1] * (1.0 - t) + b[1] * t,
        a[2] * (1.0 - t) + b[2] * t,
        1.0
    );
}

function update24HourLighting(modelViewMatrix) {
    const t = hourOfDay / 24.0;
    const angle = t * 2.0 * Math.PI;

    const sunHeight = Math.sin(angle);
    const daylight = smoothstep(-0.35, 0.75, sunHeight);
    const nightAmount = 1.0 - daylight;
    const twilight = smoothstep(0.15, 0.95, 1.0 - Math.abs(sunHeight));

    const sunRadius = 90.0;

    const sunX = Math.cos(angle) * sunRadius;
    const sunZ = Math.sin(angle) * sunRadius; 
    const sunY = Math.sin(angle) * 45.0 + 8.0;

    const lightPosition = vec4(sunX, sunY, sunZ, 1.0);
    const lightEye = mult(modelViewMatrix, lightPosition);

    const skyNight   = vec4(0.035, 0.045, 0.080, 1.0);
    const skyDawn    = vec4(0.42, 0.44, 0.56, 1.0);
    const skySunrise = vec4(0.70, 0.58, 0.48, 1.0);
    const skyMorning = vec4(0.56, 0.70, 0.86, 1.0);
    const skyNoon    = vec4(0.50, 0.72, 0.95, 1.0);
    const skySunset  = vec4(0.78, 0.48, 0.34, 1.0);
    const skyDusk    = vec4(0.25, 0.28, 0.42, 1.0);

    let skyColor;

    if (hourOfDay < 4.0) {
        skyColor = skyNight;
    } else if (hourOfDay < 5.5) {
        skyColor = mixVec4(skyNight, skyDawn, (hourOfDay - 4.0) / 1.5);
    } else if (hourOfDay < 7.0) {
        skyColor = mixVec4(skyDawn, skySunrise, (hourOfDay - 5.5) / 1.5);
    } else if (hourOfDay < 9.0) {
        skyColor = mixVec4(skySunrise, skyMorning, (hourOfDay - 7.0) / 2.0);
    } else if (hourOfDay < 15.5) {
        skyColor = mixVec4(skyMorning, skyNoon, (hourOfDay - 9.0) / 6.5);
    } else if (hourOfDay < 17.5) {
        skyColor = mixVec4(skyNoon, skySunset, (hourOfDay - 15.5) / 2.0);
    } else if (hourOfDay < 19.5) {
        skyColor = mixVec4(skySunset, skyDusk, (hourOfDay - 17.5) / 2.0);
    } else if (hourOfDay < 21.0) {
        skyColor = mixVec4(skyDusk, skyNight, (hourOfDay - 19.5) / 1.5);
    } else {
        skyColor = skyNight;
    }

    const lightAmbient = vec4(
        0.28 + daylight * 0.14 + nightAmount * 0.10,
        0.28 + daylight * 0.14 + nightAmount * 0.10,
        0.30 + daylight * 0.16 + nightAmount * 0.14,
        1.0
    );

    const lightDiffuse = vec4(
        0.58 + daylight * 0.22 + twilight * 0.14,
        0.56 + daylight * 0.20 + twilight * 0.08,
        0.58 + daylight * 0.18 + nightAmount * 0.08,
        1.0
    );

    const lightSpecular = vec4(
        0.65 + daylight * 0.18,
        0.65 + daylight * 0.18,
        0.70 + daylight * 0.14,
        1.0
    );

    gl.uniform4fv(ambientLoc, flatten(mult(lightAmbient, materialAmbient)));
    gl.uniform4fv(diffuseLoc, flatten(mult(lightDiffuse, materialDiffuse)));
    gl.uniform4fv(specularLoc, flatten(mult(lightSpecular, materialSpecular)));
    gl.uniform4fv(lightPositionLoc, flatten(lightEye));
    gl.uniform1f(shininessLoc, 42.0);

    const skyTopColor = vec4(
        Math.min(skyColor[0] * 0.85 + 0.04, 1.0),
        Math.min(skyColor[1] * 0.90 + 0.05, 1.0),
        Math.min(skyColor[2] * 1.15 + 0.06, 1.0),
        1.0
    );

    const skyBottomColor = vec4(
        Math.min(skyColor[0] * 1.15 + 0.05, 1.0),
        Math.min(skyColor[1] * 1.08 + 0.04, 1.0),
        Math.min(skyColor[2] * 0.95 + 0.02, 1.0),
        1.0
    );

    gl.uniform4fv(skyTopLoc, flatten(skyTopColor));
    gl.uniform4fv(skyBottomLoc, flatten(skyBottomColor));
    gl.clearColor(skyColor[0], skyColor[1], skyColor[2], 1.0);

    let reflectionLength;
    let reflectionOpacity;

    if (hourOfDay < 6.0) {
        reflectionLength = 0.65;
        reflectionOpacity = 0.10;
    } else if (hourOfDay < 10.0) {
        reflectionLength = 1.15;
        reflectionOpacity = 0.20;
    } else if (hourOfDay < 15.0) {
        reflectionLength = 0.75;
        reflectionOpacity = 0.14;
    } else if (hourOfDay < 19.0) {
        reflectionLength = 1.25;
        reflectionOpacity = 0.24;
    } else {
        reflectionLength = 0.80;
        reflectionOpacity = 0.12;
    }

    gl.uniform1f(reflectionLengthLoc, reflectionLength);
    gl.uniform1f(reflectionOpacityLoc, reflectionOpacity);

    let waterHighlight;
    let waterHighlightColor;

    if (hourOfDay < 5.5) {
        waterHighlight = 0.18;
        waterHighlightColor = vec4(0.35, 0.45, 0.85, 1.0); 
    } else if (hourOfDay < 8.0) {
        waterHighlight = 0.42;
        waterHighlightColor = vec4(1.0, 0.62, 0.42, 1.0); 
    } else if (hourOfDay < 15.5) {
        waterHighlight = 0.30;
        waterHighlightColor = vec4(0.75, 0.90, 1.0, 1.0); 
    } else if (hourOfDay < 19.0) {
        waterHighlight = 0.55;
        waterHighlightColor = vec4(1.0, 0.50, 0.28, 1.0); 
    } else {
        waterHighlight = 0.24;
        waterHighlightColor = vec4(0.45, 0.35, 0.80, 1.0); 
    }

    gl.uniform1f(waterHighlightLoc, waterHighlight);
    gl.uniform4fv(waterHighlightColorLoc, flatten(waterHighlightColor));

    const shadowLength = 1.0 - daylight;

    const shadowX = -Math.cos(angle) * (0.15 + shadowLength * 1.35);
    const shadowZ = -Math.sin(angle) * (0.10 + shadowLength * 0.85);

    const shadowStrength =
        0.12 +
        daylight * 0.18 +
        twilight * 0.20 +
        nightAmount * 0.06;

    gl.uniform2fv(shadowOffsetLoc, flatten(vec2(shadowX, shadowZ)));
    gl.uniform1f(shadowStrengthLoc, shadowStrength);
}

async function loadSTLModel(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("Could not load STL file: " + url);
    }

    const buffer = await response.arrayBuffer();
    const triangles = normalizeTriangles(parseSTL(buffer));

    for (const tri of triangles) {
        const normal = normalize3(tri.normal);
        const verts = [tri.v1, tri.v2, tri.v3];

        for (const v of verts) {
            positionsArray.push(vec4(v[0], v[1], v[2], 1.0));
            normalsArray.push(vec3(normal[0], normal[1], normal[2]));
            texCoordsArray.push(vec2(v[0], v[2]));
            materialArray.push(MATERIAL_STONE);
        }
    }

    addGround();
    addReflectingPool();
    addRealisticWaterReflection();
    addBuildingShadow();
}


async function fetchSTL(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Could not load STL file: " + url);
    return await response.arrayBuffer();
}

function addSkyPlane() {
    const yBottom = -8.0;
    const yTop = 35.0;
    const backZ = -35.0;
    const frontZ = 35.0;
    const leftX = -55.0;
    const rightX = 55.0;

    pushQuad(
        [[leftX, yBottom, backZ], [rightX, yBottom, backZ], [rightX, yTop, backZ], [leftX, yTop, backZ]],
        [0, 1, 2, 0, 2, 3],
        [0, 0, 1],
        MATERIAL_SKY,
        [[0, 0], [1, 0], [1, 1], [0, 1]]
    );

    pushQuad(
        [[leftX, yBottom, frontZ], [leftX, yBottom, backZ], [leftX, yTop, backZ], [leftX, yTop, frontZ]],
        [0, 1, 2, 0, 2, 3],
        [1, 0, 0],
        MATERIAL_SKY,
        [[0, 0], [1, 0], [1, 1], [0, 1]]
    );

    pushQuad(
        [[rightX, yBottom, backZ], [rightX, yBottom, frontZ], [rightX, yTop, frontZ], [rightX, yTop, backZ]],
        [0, 1, 2, 0, 2, 3],
        [-1, 0, 0],
        MATERIAL_SKY,
        [[0, 0], [1, 0], [1, 1], [0, 1]]
    );
}
function addCityBuildings() {
    addCityLayer(-26.0, -42.0, 42.0, 7.0, 1.0);
    addCityLayer(-21.5, -36.0, 36.0, 5.2, 0.82);
}

function addCityLayer(z, left, right, baseHeight, scale) {
    const baseY = -2.15;
    let x = left;

    let i = 0;
    while (x < right) {
        const width = (2.4 + Math.abs(Math.sin(i * 1.7)) * 1.2) * scale;
        const height = (baseHeight + Math.abs(Math.sin(i * 1.25)) * 5.5) * scale;
        const yTop = baseY + height;

        addCityBuilding(x, z, width, height);

        x += width * 1.55;
        i++;
    }
}

function addCityBuilding(cx, z, width, height) {
    const baseY = -2.15;
    const yTop = baseY + height;
    const depth = 1.1;

    pushQuad(
        [
            [cx - width, baseY, z],
            [cx + width, baseY, z],
            [cx + width, yTop,  z],
            [cx - width, yTop,  z]
        ],
        [0, 1, 2, 0, 2, 3],
        [0, 0, 1],
        MATERIAL_CITY,
        [[0, 0], [1.6, 0], [1.6, 3.5], [0, 3.5]]
    );

    pushQuad(
        [
            [cx - width, baseY, z],
            [cx - width, baseY, z - depth],
            [cx - width, yTop,  z - depth],
            [cx - width, yTop,  z]
        ],
        [0, 1, 2, 0, 2, 3],
        [1, 0, 0],
        MATERIAL_CITY,
        [[0, 0], [0.5, 0], [0.5, 3.5], [0, 3.5]]
    );

    pushQuad(
        [
            [cx + width, baseY, z - depth],
            [cx + width, baseY, z],
            [cx + width, yTop,  z],
            [cx + width, yTop,  z - depth]
        ],
        [0, 1, 2, 0, 2, 3],
        [-1, 0, 0],
        MATERIAL_CITY,
        [[0, 0], [0.5, 0], [0.5, 3.5], [0, 3.5]]
    );

    pushQuad(
        [
            [cx - width, yTop, z],
            [cx + width, yTop, z],
            [cx + width, yTop, z - depth],
            [cx - width, yTop, z - depth]
        ],
        [0, 1, 2, 0, 2, 3],
        [0, 1, 0],
        MATERIAL_STONE,
        [[0, 0], [1, 0], [1, 1], [0, 1]]
    );
}

function addFrontTreeBushLine() {
    const yBottom = -2.08;
    const yTop = 1.25;    
    const z = -18.8;       
    const left = -48.0;
    const right = 48.0;

    pushQuad(
        [
            [left,  yBottom, z],
            [right, yBottom, z],
            [right, yTop,    z],
            [left,  yTop,    z]
        ],
        [0, 1, 2, 0, 2, 3],
        [0, 0, 1],
        MATERIAL_GROUND,
        [[0, 0], [18, 0], [18, 2], [0, 2]]
    );
}
async function loadImageTexture(url) {
    const image = new Image();
    image.src = url;

    await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
    });

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image
    );

    gl.generateMipmap(gl.TEXTURE_2D);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    return texture;
}
function addRealisticWaterReflection() {
    const y = -2.140; 

    const left = -2.6;
    const right = 2.6;

    const startZ = 1.0;
    const endZ = 22.0;

    pushQuad(
        [
            [left, y, startZ],
            [right, y, startZ],
            [right, y, endZ],
            [left, y, endZ]
        ],
        [0, 1, 2, 0, 2, 3],
        [0, 1, 0],
        MATERIAL_REFLECTION,
        [[0, 0], [1, 0], [1, 1], [0, 1]]
    );
}
function addBuildingShadow() {
    const y = -2.145; 
    const size = 45.0; 
    pushQuad(
        [
            [-size, y, -size],
            [ size, y, -size],
            [ size, y,  size],
            [-size, y,  size]
        ],
        [0, 1, 2, 0, 2, 3],
        [0, 1, 0],
        MATERIAL_SHADOW,
        [[0, 0], [20, 0], [20, 20], [0, 20]]
    );
}

function addGround() {
    const y = -2.15;
    const size = 45.0;

    pushQuad(
        [
            [-size, y, -size],
            [ size, y, -size],
            [ size, y,  size],
            [-size, y,  size]
        ],
        [0, 1, 2, 0, 2, 3],
        [0, 1, 0],
        MATERIAL_GROUND,
        [[0,0], [20,0], [20,20], [0,20]]
    );
}

function addReflectingPool() {
    const y = -2.145;

    const left = -2.6;
    const right = 2.6;
    const nearFront = 1.0;
    const farEnd = 22.0;

    pushQuad(
        [
            [left, y, nearFront],
            [right, y, nearFront],
            [right, y, farEnd],
            [left, y, farEnd]
        ],
        [0, 1, 2, 0, 2, 3],
        [0, 1, 0],
        MATERIAL_WATER,
        [[0, 0], [1, 0], [1, 1], [0, 1]]
    );

    addPoolRim(left, right, nearFront, farEnd, -2.135);
}

function addPoolRim(left, right, nearFront, farEnd, y) {
    const rimWidth = 0.18;

    addStoneStrip(left - rimWidth, right + rimWidth, nearFront + rimWidth, nearFront, y);
    addStoneStrip(left - rimWidth, right + rimWidth, farEnd, farEnd - rimWidth, y);
    addStoneStrip(left - rimWidth, left, nearFront, farEnd, y);
    addStoneStrip(right, right + rimWidth, nearFront, farEnd, y);
}

function addStoneStrip(x1, x2, z1, z2, y) {
    pushQuad(
        [
            [x1, y, z1],
            [x2, y, z1],
            [x2, y, z2],
            [x1, y, z2]
        ],
        [0, 1, 2, 0, 2, 3],
        [0, 1, 0],
        MATERIAL_STONE,
        [[0, 0], [1, 0], [1, 1], [0, 1]]
    );
}

function pushQuad(verts, indices, normal, material, uvs) {
    for (const i of indices) {
        const v = verts[i];
        const uv = uvs[i];

        positionsArray.push(vec4(v[0], v[1], v[2], 1.0));
        normalsArray.push(vec3(normal[0], normal[1], normal[2]));
        texCoordsArray.push(vec2(uv[0], uv[1]));
        materialArray.push(material);
    }
}

function parseSTL(arrayBuffer) {
    const view = new DataView(arrayBuffer);

    if (arrayBuffer.byteLength >= 84) {
        const triangleCount = view.getUint32(80, true);
        const expectedSize = 84 + triangleCount * 50;

        if (expectedSize === arrayBuffer.byteLength) {
            return parseBinarySTL(view, triangleCount);
        }
    }

    const text = new TextDecoder().decode(arrayBuffer);
    return parseASCIISTL(text);
}

function parseBinarySTL(view, triangleCount) {
    const triangles = [];
    let offset = 84;

    for (let i = 0; i < triangleCount; i++) {
        let normal = [
            view.getFloat32(offset, true),
            view.getFloat32(offset + 4, true),
            view.getFloat32(offset + 8, true)
        ];

        offset += 12;

        const v1 = [
            view.getFloat32(offset, true),
            view.getFloat32(offset + 4, true),
            view.getFloat32(offset + 8, true)
        ];

        offset += 12;

        const v2 = [
            view.getFloat32(offset, true),
            view.getFloat32(offset + 4, true),
            view.getFloat32(offset + 8, true)
        ];

        offset += 12;

        const v3 = [
            view.getFloat32(offset, true),
            view.getFloat32(offset + 4, true),
            view.getFloat32(offset + 8, true)
        ];

        offset += 12;
        offset += 2;

        if (length3(normal) < 1e-6) {
            normal = computeNormal(v1, v2, v3);
        }

        triangles.push({ normal, v1, v2, v3 });
    }

    return triangles;
}

function parseASCIISTL(text) {
    const triangles = [];
    const lines = text.split(/\r?\n/);

    let normal = [0, 0, 1];
    let verts = [];

    for (let line of lines) {
        line = line.trim();
        const parts = line.split(/\s+/);

        if (parts[0] === "facet" && parts[1] === "normal") {
            normal = [
                parseFloat(parts[2]),
                parseFloat(parts[3]),
                parseFloat(parts[4])
            ];
        } else if (parts[0] === "vertex") {
            verts.push([
                parseFloat(parts[1]),
                parseFloat(parts[2]),
                parseFloat(parts[3])
            ]);

            if (verts.length === 3) {
                let n = normal;

                if (length3(n) < 1e-6) {
                    n = computeNormal(verts[0], verts[1], verts[2]);
                }

                triangles.push({
                    normal: n,
                    v1: verts[0],
                    v2: verts[1],
                    v3: verts[2]
                });

                verts = [];
            }
        }
    }

    return triangles;
}

function normalizeTriangles(triangles) {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (const tri of triangles) {
        for (const v of [tri.v1, tri.v2, tri.v3]) {
            minX = Math.min(minX, v[0]);
            minY = Math.min(minY, v[1]);
            minZ = Math.min(minZ, v[2]);
            maxX = Math.max(maxX, v[0]);
            maxY = Math.max(maxY, v[1]);
            maxZ = Math.max(maxZ, v[2]);
        }
    }

    const cx = (minX + maxX) * 0.5;
    const cy = (minY + maxY) * 0.5;
    const cz = (minZ + maxZ) * 0.5;

    const maxSize = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
    const scale = 6.2 / maxSize;

    const normalized = [];

    for (const tri of triangles) {
        const v1 = normalizeVertex(tri.v1, cx, cy, cz, scale);
        const v2 = normalizeVertex(tri.v2, cx, cy, cz, scale);
        const v3 = normalizeVertex(tri.v3, cx, cy, cz, scale);

        normalized.push({
            normal: computeNormal(v1, v2, v3),
            v1,
            v2,
            v3
        });
    }

    return normalized;
}

function normalizeVertex(v, cx, cy, cz, scale) {
    const x = (v[0] - cx) * scale;
    const y = (v[1] - cy) * scale;
    const z = (v[2] - cz) * scale;

    return [
        x,
        z - 0.8,
        -y - 1.8
    ];
}

function render(now) {
    resizeCanvasToDisplaySize();

    now *= 0.001;

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const eye = getEyePosition();
    const modelViewMatrix = lookAt(eye, target, up);
    const projectionMatrix = perspective(fovy, aspect, near, far);

    if (previousTime === 0.0) {
        previousTime = now;
    }

    const deltaTime = now - previousTime;
    previousTime = now;

    if (isPlaying) {
        hourOfDay += deltaTime * daySpeed;

        if (hourOfDay >= 24.0) {
            hourOfDay -= 24.0;
        }
    }

    update24HourLighting(modelViewMatrix);

    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(modelViewMatrix));
    gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));
    gl.uniform1f(waterTimeLoc, now);

    gl.drawArrays(gl.TRIANGLES, 0, positionsArray.length);

    requestAnimationFrame(render);
}

function resizeCanvasToDisplaySize() {
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
        aspect = canvas.width / canvas.height;
    }
}

function getEyePosition() {
    const x = target[0] + radius * Math.cos(pitch) * Math.sin(yaw);
    const y = target[1] + radius * Math.sin(pitch);
    const z = target[2] + radius * Math.cos(pitch) * Math.cos(yaw);

    return vec3(x, y, z);
}

function onWheel(event) {
    if (cameraLocked) return;
    event.preventDefault();
    radius += event.deltaY * 0.01;
    radius = Math.max(3.5, Math.min(16.0, radius));
}

function onMouseDown(event) {
    if (cameraLocked) {
        isDragging = false;
        return;
    }
    isDragging = true;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
}

function onMouseMove(event) {
    if (cameraLocked) return;
    if (!isDragging) return;

    const dy = event.clientY - lastMouseY;

    pitch += dy * 0.006;

    pitch = Math.max(-0.15, Math.min(1.25, pitch));

    lastMouseY = event.clientY;
}

function onMouseUp() {
    isDragging = false;
}
function createStoneTexture(w, h) {
    const data = new Uint8Array(w * h * 3);

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 3;

            const n1 = pseudoNoise(x * 0.05, y * 0.05);
            const n2 = pseudoNoise(x * 0.15 + 10.0, y * 0.15 + 5.0);
            const vein = Math.pow(Math.abs(Math.sin((x + y * 0.8) * 0.035 + n2 * 4.0)), 14.0);

            const base = 175 + n1 * 28 + n2 * 12 + vein * 45;

            data[i] = clampByte(base + 10);
            data[i + 1] = clampByte(base + 6);
            data[i + 2] = clampByte(base - 4);
        }
    }

    return makeTexture(w, h, data);
}

function createGroundTexture(w, h) {
    const data = new Uint8Array(w * h * 3);

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 3;

            const large = pseudoNoise(x * 0.035, y * 0.035);
            const medium = pseudoNoise(x * 0.12 + 8.0, y * 0.12 + 3.0);
            const fine = pseudoNoise(x * 0.55 + 2.0, y * 0.75 + 9.0);

            const blade = Math.pow(Math.abs(Math.sin(x * 0.28 + y * 0.08 + fine * 4.0)), 10.0);

            const dirtPatch = smoothstep(0.58, 0.82, large) * 0.55;

            let r = 32 + medium * 28 + blade * 25;
            let g = 78 + medium * 70 + fine * 30 + blade * 55;
            let b = 24 + medium * 20 + blade * 12;

            r = r * (1.0 - dirtPatch) + 78 * dirtPatch;
            g = g * (1.0 - dirtPatch) + 58 * dirtPatch;
            b = b * (1.0 - dirtPatch) + 32 * dirtPatch;

            data[i] = clampByte(r);
            data[i + 1] = clampByte(g);
            data[i + 2] = clampByte(b);
        }
    }

    return makeTexture(w, h, data);
}

function createWaterTexture(w, h) {
    const data = new Uint8Array(w * h * 3);

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 3;

            const wave1 = Math.sin(x * 0.15 + y * 0.05);
            const wave2 = Math.sin(x * 0.05 - y * 0.20);
            const n = (wave1 + wave2) * 0.5;

            data[i] = clampByte(25 + n * 18);
            data[i + 1] = clampByte(75 + n * 24);
            data[i + 2] = clampByte(95 + n * 35);
        }
    }

    return makeTexture(w, h, data);
}

function makeTexture(w, h, data) {
    const texture = gl.createTexture();

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGB,
        w,
        h,
        0,
        gl.RGB,
        gl.UNSIGNED_BYTE,
        data
    );

    gl.generateMipmap(gl.TEXTURE_2D);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const ext = gl.getExtension("EXT_texture_filter_anisotropic");
    if (ext) {
        gl.texParameterf(
            gl.TEXTURE_2D,
            ext.TEXTURE_MAX_ANISOTROPY_EXT,
            8
        );
    }

    return texture;
}

function computeNormal(a, b, c) {
    const t1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const t2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];

    return normalize3([
        t1[1] * t2[2] - t1[2] * t2[1],
        t1[2] * t2[0] - t1[0] * t2[2],
        t1[0] * t2[1] - t1[1] * t2[0]
    ]);
}

function pseudoNoise(x, y) {
    const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return s - Math.floor(s);
}

function clampByte(v) {
    return Math.max(0, Math.min(255, Math.floor(v)));
}

function length3(v) {
    return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

function normalize3(v) {
    const len = length3(v);

    if (len < 1e-8) {
        return [0, 1, 0];
    }

    return [v[0] / len, v[1] / len, v[2] / len];
}