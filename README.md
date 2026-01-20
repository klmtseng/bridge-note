# BridgeNote

**BridgeNote** is a secure, offline-first web clipboard that bridges your desktop workflow to iPhone Notes. It allows you to format text on the web and instantly transfer it to your iOS device via a local QR code generated in the browser—no login, no cloud database, and no tracking required.

## Features

- **Offline Formatting**: Clean up text, make lists, and change case without sending data to a server.
- **Privacy First**: All data is stored in your browser's local storage.
- **QR Code Bridge**: Seamlessly transfer text from Desktop to Mobile via a dynamically generated QR code.
- **iOS Integration**: Uses the native Web Share API to save directly to Apple Notes.

## Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run local server:
   ```bash
   npm run dev
   ```

## Deployment to GitHub Pages

1. Build the project:
   ```bash
   npm run build
   ```

2. Upload the contents of the `dist` folder to your web host, or configure GitHub Actions to deploy automatically.
