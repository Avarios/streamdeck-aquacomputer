# Security

The plugin reads from a local USB HID device (the Quadro) and never writes to it.

Network access happens only if you enable the optional **LibreHardwareMonitor** integration: the plugin then sends
one HTTP GET per second to the configured address (default `http://localhost:8085/data.json`, your own PC) and
only reads the response. No data is sent anywhere else, there is no telemetry.

If you find a security issue, please report it privately via GitHub "Security advisories" instead of a public issue.
