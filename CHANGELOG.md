# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/), versions follow [SemVer](https://semver.org/)
(the manifest uses the four-part form `MAJOR.MINOR.PATCH.0`).

## [1.0.5] - 2026-11-09

### Added
- **Rotate:** interval `0` switches values only on key press.
- LibreHardwareMonitor enable option and address (default `http://localhost:8085/data.json`) in the Temperature panel.

### Changed
- Temperature key lists only real temperatures from LibreHardwareMonitor (no TjMax distances), with hints when LHM is off or unreachable.

## [1.0.4] - 2026-11-09

### Added
- **Temperature key:** LibreHardwareMonitor temperatures can be picked in the *Sensor* dropdown.

## [1.0.3] - 2026-11-07

### Added
- **Several Quadros:** all connected Quadros are opened; every Quadro key has a new *Quadro* dropdown to bind it to
  a device by serial number. Graphs are kept per device.

### Changed
- "Automatic" now always uses the Quadro with the lowest serial number instead of whichever device Windows lists
  first.
- HID interfaces of the Quadro that send no status report are ignored for a minute instead of being reopened
  continuously.

## [1.0.2] - 2026-11-07

### Added
- Optional **LibreHardwareMonitor** integration (off by default): when enabled and LHM's web server is running,
  CPU / GPU / mainboard / drive sensors become available.
- New action **PC Sensor** for a single LHM sensor (keys and dials) with warn thresholds and history graph.
- **Rotation**: PC sensors can be ticked in an additional list and are shown after the Quadro values; they keep
  rotating while the Quadro is disconnected.

### Changed
- Long labels are drawn with a smaller font so sensor names fit on the key.

### Fixed
- CI: removed the npm cache option that required a `package-lock.json`.

### Other
- Release workflow can also be started manually (Actions → Release → Run workflow).

## [1.0.1] - 2026-11-07

### Changed
- New plugin and category icons (water drop with fan), new Fan / Pump and Flow action icons.
- Icons moved from `imgs/` to `assets/`; screenshots for the Marketplace added.

## [1.0.0] - 2026-11-07

First public release.

### Added
- Actions: **Temperature**, **Fan / Pump**, **Flow** and **Rotation** for keys and Stream Deck + dials.
- Translucent history graph behind the value (1 / 5 / 15 / 30 min window).
- Alarm thresholds (warn temperature, minimum RPM, minimum flow) turn the value red.
- Automatic reconnect when the Quadro is unplugged or the PC resumes from sleep.
- Property inspector with dynamic sensor / fan lists filled from the live device report.

### Notes
- Tested only with the Aquacomputer Quadro on Windows.
