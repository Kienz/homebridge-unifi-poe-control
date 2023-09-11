# homebridge-unifi-poe-control

## Releases

### v1.3.0
- Multiple UniFiOS API calls should wait unit previous calls are completed

### v1.2.2
- Add "passthrough" to PoE "onMode"

### v1.2.1
- Remove logging 'Refreshing devices...' - it's displayed in debug mode
- README fixes

### v1.2.0
- Refresh devices before update to get current config - Fixes https://github.com/Kienz/homebridge-unifi-poe-control/issues/4
- Add new "port_override" item if no port override exists - Fixes https://github.com/Kienz/homebridge-unifi-poe-control/issues/3
- Housekeeping

### v1.1.4
- Housekeeping
- Add funding option in Homebridge Plugin search
- Add "verified-by-homebridge" Badge

### v1.1.3
- Housekeeping

### v1.1.2
- Housekeeping

### v1.1.1
- Bugfix new option `apiMode`

### v1.1.0
- New options `apiMode` to force the plugin to use UniFi OS or old API. (Default = null - options: `UniFiOS` | `old`)

### v1.0.1
- Bugfix generate UUID - `Error getting devices: Error: Cannot add a bridged Accessory with the same UUID as another bridged Accessory`

### v1.0.0
- Add option to PowerCycle POE Port - only if POE Port is active (onMode = power_cycle)

### v0.1.0
- Initial release
