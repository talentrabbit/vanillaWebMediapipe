# Gesture Particles

Single-page vanilla web app that uses MediaPipe Hands to classify number gestures from 0-9 and render a matching generated PNG in a Three.js particle scene.

## Run locally

Serve the folder over `http://localhost` or `https://` because camera access does not work reliably from a raw `file://` URL.

### Start the app (Windows PowerShell)

From the project root:

`./scripts/start.ps1`

Optional custom port:

`./scripts/start.ps1 -Port 8090`

Then open the printed URL (default: `http://127.0.0.1:8080`).

### Stop the app

From the project root:

`./scripts/stop.ps1`

## Custom digit PNG folder

Optional custom digit textures can be placed in:

`assets/custom-png/`

Use the exact filenames `0.png` through `9.png`.

When a file exists for a digit, it overrides the generated PNG for that digit in both the UI preview and Three.js particles. Missing files automatically fall back to generated textures.