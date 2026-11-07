# Quadro live report (HID input report 0x01)

Verified **only on the Aquacomputer Quadro** (VID `0x0C70`, PID `0xF00D`). Other devices use different layouts.

The configuration feature report (`0x03`) contains no measurements. The Quadro pushes the live values about once
per second as an **input report with ID `0x01`**: 220 bytes (`0xDC`), big-endian, **no CRC**. Offsets were verified
against Aquasuite (temperatures, flow, fan RPM). The HID report descriptor carries no semantics, so the offsets
below were found empirically.

| Offset | Type | Meaning | Status |
|---|---|---|---|
| `0x03`, `0x05` | u16, u16 | Serial number (`%05u-%05u`) | verified |
| `0x0d` | u16 | Firmware version | verified |
| `0x14` | u32 | Uptime in seconds | verified (+1/s) |
| `0x18` | u32 | Power cycles | unverified |
| `0x28`-`0x33` | u16 each | Raw sensor values | unknown |
| `0x34` | 4 x i16 | Temperature sensors 1-4, /100 °C, `0x7FFF` = not connected | verified |
| `0x3c` | 16 x i16 | Virtual sensors, /100 °C, `0x7FFF` = unused | layout verified |
| `0x6c` | u16 | Input voltage, /100 V | plausible |
| `0x6e` | u16 | Flow, /10 l/h | verified |
| `0x70`, `0x7d`, `0x8a`, `0x97` | 13-byte blocks | Fans 1-4 (see below) | verified |
| `0xa8` + n*8 | `03e8`, u16 | Per-channel output, /100 % | partially understood |
| `0xd4` | u16 | Fast-running counter (~3/s) | unknown |

Fan block (relative to its start): `+0` output /100 %, `+2` voltage /100 V, `+4` current in mA,
`+6` power /100 W, `+8` speed in RPM.

## Notes

- Current / power are only measured for fans connected directly to the Quadro (a pump with external power reports 0 A / 0 W).
- PC sensors shown in Aquasuite (CPU / GPU) are **not** stored in the device; virtual sensor slots stay `0x7FFF`
  unless something writes to them.
- Unconnected fan channels can show a small noise RPM (e.g. ~148 RPM); the UI flags fans without load and below 200 RPM
  as "probably unconnected".
