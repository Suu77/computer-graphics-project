# Lincoln Memorial Interactive 3D Day/Night Scene

An interactive 3D graphics project built with **WebGL 2.0, JavaScript, GLSL, and HTML**. The project renders a 3D Lincoln Memorial scene with realistic materials, water, reflections, shadows, city scenery, and a simulated 24-hour lighting cycle.

## Features

- **24-hour day/night simulation** — The scene transitions through night, dawn, sunrise, morning, noon, sunset, dusk, and night.
- **Dynamic lighting** — The light source moves based on the simulated time of day and changes ambient, diffuse, and specular lighting.
- **Realistic water** — Includes animated water patterns, highlights, and a reflection of the Lincoln Memorial.
- **Dynamic shadows** — The Memorial's ground shadow changes position and strength as the light source moves.
- **Textured 3D environment** — Uses stone, grass, water, sky/cloud, and building textures.
- **Procedural textures** — Generates stone, ground, and water textures directly in JavaScript.
- **City background** — Includes multiple layers of buildings to create additional depth.
- **Interactive camera** — Supports a fixed camera and an interactive one-point perspective camera with orbit and zoom controls.
- **3D model loading** — Loads the Lincoln Memorial from STL files (@JB3Designs on Printables) and converts the model data into WebGL geometry.
- **GLSL shaders** — Uses custom vertex and fragment shaders for lighting, materials, reflections, water effects, shadows, and color transitions.
- **Real-time rendering** — Uses `requestAnimationFrame()` to continuously update the scene.

## How It Works

The application loads STL files representing the Lincoln Memorial, parses the model data, calculates normals and texture coordinates, and converts the geometry into WebGL buffers.

The scene then combines the Memorial with the ground, reflecting pool, water reflection, shadows, sky, city buildings, and surrounding environment.

Custom GLSL shaders are used to control how different materials are rendered, including stone, grass, water, reflections, shadows, sky, and buildings.

### Day/Night Lighting

The simulated time is represented by an `hourOfDay` value from 0–24.

As time changes, the program updates:

- Sun/light position
- Ambient lighting
- Diffuse lighting
- Specular lighting
- Sky color
- Cloud appearance
- Water highlights
- Reflection strength
- Shadow position and intensity

This creates a continuous transition between nighttime, sunrise, daytime, sunset, and nighttime.

### Water and Reflections

The reflecting pool uses animated water effects to create movement on the surface.

The scene also creates a reflection of the Lincoln Memorial in the water. Reflection length, opacity, and highlights change depending on the simulated time of day.

### Camera Controls

The project includes two camera modes.

**Fixed Camera**
- Displays a predefined view of the Lincoln Memorial.

**One-Point Perspective**
- Allows the viewer to interact with the camera.
- Mouse movement controls the camera view.
- Mouse wheel controls zoom.

## Technologies

- JavaScript
- WebGL 2.0
- GLSL
- HTML/CSS
- Texture mapping
- 3D transformations
- Perspective projection
- Lighting calculations
- Procedural texture generation
- Real-time animation