# Stream Deck Marketplace submission guide

Everything you need for the Elgato **Maker Console** (https://maker.elgato.com). Not part of the plugin package.

## 1. Before you submit

- [ ] Create the GitHub repo `Avarios/streamdeck-quadro` (the URL in `manifest.json` and `package.json` already points there) and push this folder.
- [ ] Last chance to change the UUID `com.avarios.aquars` (reverse-DNS, **cannot change after publishing**).
- [ ] `npm install && npm run release` (typecheck, tests, build, **`streamdeck validate`**, pack) - must pass without errors.
- [ ] Install the resulting `com.avarios.aquars.streamDeckPlugin` on a clean profile and test every action on a key
      (and on a dial if you own a Stream Deck +), including unplugging / replugging the Quadro.
- [ ] Test with Aquasuite closed and open (see README).
- [ ] Remove anything personal: the test fixture's serial number is already anonymised.

## 2. Listing text (copy & paste)

**Name:** Aquars Quadro

**Short description (<= ~100 chars):**
Live temperatures, fan/pump speed and flow of your Aquacomputer Quadro - with history graphs.

**Description:**

> Monitor your water-cooling loop at a glance. Aquars Quadro shows live values of the Aquacomputer Quadro on
> Stream Deck keys and dials: temperature sensors, fan and pump RPM / output / power, and flow rate in l/h.
> A translucent history graph sits behind every value, and warning thresholds turn the value red when a
> temperature gets too high or a fan, pump or flow drops too low. A Rotation action cycles through all values on a
> single key.
>
> **Compatibility:** currently tested only with the Aquacomputer Quadro (Windows). Other Aquacomputer devices are
> not supported yet. If keys show "n/a", close Aquasuite.
>
> This is an unofficial community plugin and is not affiliated with Aquacomputer or Elgato. Read-only - it never
> changes settings on your device. No network access.

**Category:** Utilities / System (pick the closest available in the Maker Console)
**Tags:** aquacomputer, quadro, water cooling, temperature, fan, pump, flow, pc monitoring
**Platform:** Windows 10+  |  **Min. Stream Deck app:** 7.1
**Support / source URL:** your GitHub repository
**License:** Apache-2.0

## 3. Assets you still need to create (not generated)

| Asset | Size | Notes |
|---|---|---|
| Marketplace icon | 288 x 288 px PNG | Can be derived from `imgs/plugin/marketplace@2x.png` (512 px) |
| Preview / gallery images | 1920 x 960 px (min. 3 recommended) | Screenshots of real keys and the property inspector |
| Optional video | up to a few seconds | Keys updating live |

Take screenshots with real data. Do not use Aquacomputer or Elgato logos in the images.

## 4. Review tips

- State the Quadro-only compatibility in the description (done above) and in the release notes.
- Provide a changelog entry for each update (`CHANGELOG.md`); bump `Version` in the manifest (4-part: `1.0.1.0`).
- Rejections most often concern missing/unclear icons, trademark use in the name, or manifest validation errors.
  The name deliberately avoids "Aquacomputer" as a brand prefix; it is only used descriptively.
