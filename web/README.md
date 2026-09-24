# PiniGamepad Web

This folder contains the ESP32 controller web app. The client is JavaScript rendered from a Handlebars template and bundled with webpack.

## Build

```powershell
npm install
npm run build
```

The production files are generated in `web/build`.

For an unminified debug output with preserved whitespace, run `npm run debug`. Its files are generated in `web/debug`.

To run the small Node API against the production bundle:

```powershell
npm run build
npm run server
```

The API exposes `GET /api/status` and `POST /api/input`.

## Firmware handoff

Keep paths compatible with the firmware server:

- `index.html`
- `resources/style.css`

The production bundle is written to `web/build`, never to the `firmware` folder. Copy the contents of `build` into the firmware web directory only when you are ready to update the firmware assets.