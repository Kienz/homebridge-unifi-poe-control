# Homebridge UniFi POE Control
[![Downloads](https://img.shields.io/npm/dt/homebridge-unifi-poe-control?color=%230559C9&logo=icloud&logoColor=%23FFFFFF&style=for-the-badge)](https://www.npmjs.com/package/homebridge-unifi-poe-control)
[![Version](https://img.shields.io/npm/v/homebridge-unifi-poe-control?color=%230559C9&label=Latest%20Version&logo=ubiquiti&logoColor=%23FFFFFF&style=for-the-badge)](https://www.npmjs.com/package/homebridge-unifi-poe-control)
[![verified-by-homebridge](https://img.shields.io/badge/homebridge-verified-blueviolet?color=%23491F59&style=for-the-badge&logoColor=%23FFFFFF&logo=homebridge)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins#verified-plugins)

HomeKit support to control the POE status of UniFi Switches using [Homebridge](https://homebridge.io).
With `homebridge-unifi-poe-control` you can enable/disable or Powercycle POE ports of UniFi Switches. Per port you can define two HomeKit switches - one for On/Off state und one for PowerCycle.
The PowerCycle feature only works for enabled POE ports.

## Configuration

For most people, I recommend using [Homebridge Configuration web UI](https://github.com/oznu/homebridge-config-ui-x) to configure this plugin rather than doing it directly. It's easier to use and less prone to typos, leading to other problems.

You can use your Ubiquiti account credentials, though 2FA is not currently supported.

That said, **I strongly recommend creating a local user just for Homebridge instead of using this option.** The local UniFi user should have the `SiteAdmin` role to control the POE status of the ports.

[UniFi Manage Users and Roles](https://help.ui.com/hc/en-us/articles/1500011491541-UniFi-Manage-users-and-user-roles)

**Example config**

```js
{
  "platforms": [
    {
      "platform": "UniFiPoeControl",
      "name": "UniFi POE",
      "url": "https://CONTROLLER_ADDRESS:443",
      "username": "YOUR_USERNAME",
      "password": "YOUR_PASSWORD",
      "refreshInterval": 60, // seconds - optional
      "apiMode": null, // optional ("old" | "UniFiOS")
      "ports": [
        {
            "mac": "aa:bb:cc:dd:ee:ff", // mac address of the switch
            "idx": 17, // port number on the switch
            "name": "ALTERNATIVE NAME", // optional
            "onMode": "auto" // optional ("auto" | "pasv24" | "power_cycle")
        }
      ]
    }
  ]
}
```

The plugin should work with old firmwares (!= UniFi OS) and UniFi OS firmwares.

The plugin will try to find out which API is present to use the right API endpoints.
If it doesn't work you can force a specific API mode (`apiMode` - `old` | `UniFiOS`).

The `onMode` defines which mode should be used if POE port changes status from offline to online. If you set `powerCycle` you can power cycle the POE port - only if the POE port is online. To control the On/Off state of the POE port define another port with `onMode="auto" | "pasv24"`.