# Contributing

Thanks for your interest! The most valuable contribution right now is **testing with other hardware**
(see the issue template "Device compatibility report"). The plugin has so far only been tested with the
**Aquacomputer Quadro**.

## Development setup

Requirements: Windows 10/11, Stream Deck app 7.1+, Node.js 20+.

```powershell
npm install
npm run build       # bundles src/ -> com.avarios.aquars.sdPlugin/bin/plugin.js, installs node-hid next to it
npm run link        # register the plugin with the Stream Deck app
npm run watch       # rebuild on change, then: streamdeck restart com.avarios.aquars
npm run typecheck
npm test
```

Close Aquasuite while testing if the keys stay on `n/a` - some setups only allow one program to hold the device.

## Pull requests

- Keep the parser (`src/status.ts`) pure and covered by tests; use anonymised captures only
  (**remove or zero the serial number** in report bytes `0x03..0x06`).
- Run `npm run typecheck && npm test` before opening a PR.
- Document protocol findings in `docs/PROTOCOL.md`, including how you verified them.
