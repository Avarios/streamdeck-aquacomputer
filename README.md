# Aquars Quadro for Stream Deck

Show the live values of your **Aquacomputer Quadro** on Elgato Stream Deck keys and dials: temperatures,
fan / pump speed, output percent, power draw and flow rate - with a history graph behind every value.

> **Important - hardware compatibility**
> This plugin has so far been **tested only with the Aquacomputer Quadro**. Other Aquacomputer devices
> (Octo, Farbwerk, D5 Next, High Flow ...) use different report layouts and are **not supported or tested**.
> Reports about other devices are welcome, see [Contributing](CONTRIBUTING.md).
>
> This is an unofficial community project. It is not affiliated with, endorsed by or supported by
> Aquacomputer / aqua computer GmbH & Co. KG or Elgato. "Aquacomputer", "Quadro" and "Aquasuite" are
> trademarks of their respective owners.

## Features

| Action | Shows | Settings |
|---|---|---|
| **Temperature** | Sensor 1-4 or virtual sensor 1-16, in °C or °F | sensor, label, warn threshold (turns red), °F |
| **Fan / Pump** | RPM, output % or power (W) of channel 1-4 | channel, view, label, "alarm below RPM". Key press cycles the view |
| **Flow** | Flow rate in l/h | label, "alarm below l/h" |
| **Rotation** | Cycles through selected values every N seconds | interval, include / exclude lists (`*`, `temp1,fan*,flow`), custom names |

- Works on **keys** and on the **Stream Deck + touch strip / dials** (press, tap or turn to switch the value).
- Translucent **history graph** behind the value (1 / 5 / 15 / 30 min; kept in memory, starts empty after a restart).
- Dropdowns only list what is actually connected, with live readings next to each entry.
- Shows `n/a` when no Quadro is found or no data arrives for 5 s, and reconnects automatically.
- Read-only: the plugin never writes anything to the device.

## Requirements

- Windows 10 / 11
- Stream Deck app 7.1 or newer
- An Aquacomputer Quadro connected via USB

If keys stay on `n/a`, close **Aquasuite** - some setups only allow one program to hold the device.

## Installation

- **Marketplace:** search for "Aquars Quadro" in the Stream Deck app (link follows after publication).
- **Manual:** download the latest `com.avarios.aquars.streamDeckPlugin` from the
  [Releases](../../releases) page and double-click it.

## Build from source

```powershell
npm install
npm run build      # bundles src/ -> com.avarios.aquars.sdPlugin/bin/plugin.js and installs node-hid next to it
npm run link       # register with the Stream Deck app (development)
npm run watch      # rebuild on change
npm test           # parser / history / rotation tests
npm run validate   # Elgato manifest validation
npm run pack       # create the installable .streamDeckPlugin
```

Project layout:

```text
src/status.ts          report parser (pure, tested)
src/quadro.ts          node-hid connection, auto-reconnect, "status"/"state" events
src/history.ts         ring buffers (30 min at 1 sample/s) for the graphs
src/catalog.ts         lists for the property inspectors, built from the live report
src/render.ts          SVG key rendering
src/actions/*.ts       Temperature / Fan / Flow / Rotation actions
com.avarios.aquars.sdPlugin/   manifest, property inspectors (ui/), icons (imgs/)
docs/PROTOCOL.md       what is known about the Quadro live report
```

## How it works

The Quadro pushes a 220-byte HID input report (ID `0x01`) about once per second. The plugin reads it with
[node-hid](https://github.com/node-hid/node-hid) and parses it - see [docs/PROTOCOL.md](docs/PROTOCOL.md).
No network access, no telemetry.

## License

[Apache License 2.0](LICENSE). Bundles [node-hid](https://github.com/node-hid/node-hid) (MIT / BSD-style, see its LICENSE).
