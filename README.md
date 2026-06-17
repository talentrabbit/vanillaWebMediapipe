# Gesture Particles

Single-page vanilla web app that uses MediaPipe Hands to classify number gestures from 0-9 and render a matching generated PNG in a Three.js particle scene.

## Run locally

Serve the folder over `http://localhost` or `https://` because camera access does not work reliably from a raw `file://` URL.

`./scripts/start.ps1` prefers the existing Node-based server when `node` is available, and otherwise falls back to a built-in PowerShell static server.

### Start the app (Windows PowerShell)

From the project root:

`./scripts/start.ps1`  or './start.cmd'

Optional custom port:

`./scripts/start.ps1 -Port 8090`

Then open the printed URL (default: `http://127.0.0.1:8080`).

### Stop the app

From the project root:

`./scripts/stop.ps1` or close window opened by './start.cmd'

## Custom digit PNG folder

Optional custom digit textures can be placed in:

`assets/custom-png/`

Use the exact filenames `0.png` through `9.png`.

When a file exists for a digit, it overrides the generated PNG for that digit in both the UI preview and Three.js particles. Missing files automatically fall back to generated textures.

## Shared gesture samples

Optional shared gesture samples can be checked in at:

`assets/gesture-samples.json`

On startup, the app preloads this file only when no gesture library already exists in browser `localStorage`.

Use the in-app `Save as repo preload` button to export the exact repo-ready JSON structure. In browsers that support the File System Access API, you can save it straight to `assets/gesture-samples.json`. Otherwise the app downloads the file for you to place there manually.

This keeps a shared default library in the repo while still allowing each machine to override it locally after import or retraining.
