# Gesture Particles

Single-page vanilla web app that uses MediaPipe Hands to classify number gestures from 0-9 and render a matching generated PNG in a Three.js particle scene.

## Run locally

Serve the folder over `http://localhost` or `https://` because camera access does not work reliably from a raw `file://` URL.

Examples:

- `python -m http.server 8080`
- `npx serve .`

Then open `http://localhost:8080`.