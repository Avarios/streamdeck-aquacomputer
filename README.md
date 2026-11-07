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
| **Rotation** | Cycles through selected values every N seconds | interval, include / exclude lists (`*`, `temp1,fan*,flow`), custom names, optional PC sensors |
| **PC Sensor** | Any CPU / GPU / mainboard / drive sensor from LibreHardwareMonitor (optional, see below) | sensor, label, warn above / below |

- Works on **keys** and on the **Stream Deck + touch strip / dials** (press, tap or turn to switch the value).
- Translucent **history graph** behind the value (1 / 5 / 15 / 30 min; kept in memory, starts empty after a restart).
- Dropdowns only list what is actually connected, with live readings next to each entry.
- Shows `n/a` when no Quadro is found or no data arrives for 5 s, and reconnects automatically.
- Read-only: the plugin never writes anything to the device.

## PC sensors via LibreHardwareMonitor (optional)

The Quadro only knows its own sensors. CPU and GPU temperatures can not be read by a normal Windows program
without a kernel driver, so the plugin can **optionally** take them from
[LibreHardwareMonitor](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor) (free, open source, not included).
The option is **off by default**; without it the plugin works exactly as before.

1. Install LibreHardwareMonitor and start it **as administrator** (otherwise CPU temperatures are missing).
2. In LibreHardwareMonitor: **Options → Remote Web Server → Run** (default port 8085).
   Optionally enable *Options → Run On Windows Startup*.
3. In the Stream Deck app open a **PC Sensor** or **Rotation** key, expand *LibreHardwareMonitor* and tick
   **Read PC sensors from LibreHardwareMonitor**. Change the address only if you use another port
   (default `http://localhost:8085/data.json`). The setting applies to all keys.
4. Pick a sensor in the **PC Sensor** dropdown (grouped by hardware, with live values), or tick PC sensors in the
   Rotation's *PC sensors* list. They are shown after the Quadro values.

While LibreHardwareMonitor is not reachable, PC Sensor keys show `n/a` (Quadro keys are not affected) and the
plugin retries every 5 s. The PC sensor feature works without a Quadro, too.

## Naming sensors and fans

The plugin reads the hardware directly over USB. The Quadro only reports **numbers by position** - it does not
tell the plugin what is connected to each port or what you called it in Aquasuite. Sensors and fans are therefore
listed in the **order of the hardware connectors** (Temperature 1-4, Fan 1-4, plus virtual sensors 1-16), and you
need to give them meaningful names yourself:

- Use the **Label** field of each Temperature / Fan / Flow action, e.g. `Coolant`, `Pump`, `Radiator`.
- In the **Rotation** action, enter names in the same order as the channels, comma-separated
  (e.g. `Pump, MORA, Front` for fan 1, 2, 3).
- Check once which physical port is which (for example by watching which value changes when the loop heats up or a
  fan is spun up) and label accordingly. Names you set in Aquasuite are **not** transferred.

Unconnected temperature sensors are greyed out in the dropdowns and fans without load are flagged
"probably unconnected" to help you find the right channel.

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
src/lhm.ts             optional LibreHardwareMonitor client (data.json parser + poller)
src/catalog.ts         lists for the property inspectors, built from the live report
src/render.ts          SVG key rendering
src/actions/*.ts       Temperature / Fan / Flow / Rotation / PC Sensor actions
com.avarios.aquars.sdPlugin/   manifest, property inspectors (ui/), icons (assets/)
docs/PROTOCOL.md       what is known about the Quadro live report
```

## How it works

The Quadro pushes a 220-byte HID input report (ID `0x01`) about once per second. The plugin reads it with
[node-hid](https://github.com/node-hid/node-hid) and parses it - see [docs/PROTOCOL.md](docs/PROTOCOL.md).
No telemetry. The only network access is the optional LibreHardwareMonitor option: when you switch it on, the
plugin polls the configured address (default `http://localhost:8085/data.json`, i.e. your own PC) once per second.

## License

[Apache License 2.0](LICENSE). Bundles [node-hid](https://github.com/node-hid/node-hid) (MIT / BSD-style, see its LICENSE).
