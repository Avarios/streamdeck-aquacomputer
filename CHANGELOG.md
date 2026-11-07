# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/), versions follow [SemVer](https://semver.org/)
(the manifest uses the four-part form `MAJOR.MINOR.PATCH.0`).

## [1.0.0] - Unreleased

First public release.

### Added
- Actions: **Temperature**, **Fan / Pump**, **Flow** and **Rotation** for keys and Stream Deck + dials.
- Translucent history graph behind the value (1 / 5 / 15 / 30 min window).
- Alarm thresholds (warn temperature, minimum RPM, minimum flow) turn the value red.
- Automatic reconnect when the Quadro is unplugged or the PC resumes from sleep.
- Property inspector with dynamic sensor / fan lists filled from the live device report.

### Notes
- Tested only with the Aquacomputer Quadro on Windows.
