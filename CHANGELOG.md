# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/), versions follow [SemVer](https://semver.org/)
(the manifest uses the four-part form `MAJOR.MINOR.PATCH.0`).

## [1.1.0] - Unreleased

### Added
- Optional **LibreHardwareMonitor** integration (off by default): when enabled and LHM's web server is running,
  CPU / GPU / mainboard / drive sensors become available.
- New action **PC Sensor** for a single LHM sensor (keys and dials) with warn thresholds and history graph.
- **Rotation**: PC sensors can be ticked in an additional list and are shown after the Quadro values; they keep
  rotating while the Quadro is disconnected.

### Changed
- Long labels are drawn with a smaller font so sensor names fit on the key.

## [1.0.0]

First public release.

### Added
- Actions: **Temperature**, **Fan / Pump**, **Flow** and **Rotation** for keys and Stream Deck + dials.
- Translucent history graph behind the value (1 / 5 / 15 / 30 min window).
- Alarm thresholds (warn temperature, minimum RPM, minimum flow) turn the value red.
- Automatic reconnect when the Quadro is unplugged or the PC resumes from sleep.
- Property inspector with dynamic sensor / fan lists filled from the live device report.

### Notes
- Tested only with the Aquacomputer Quadro on Windows.
