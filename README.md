# homebridge-unifi-poe-control
Adds UniFi device POE control to HomeKit via Homebridge

## Configuration

Use the settings UI in Homebridge Config UI X to configure your controller URL, account details and POE ports, or manually add the following to the platforms section of your config file:

```js
{
  "platforms": [
    {
      "platform": "UniFiPoeControl",
      "name": "UniFi",
      "url": "https://CONTROLLER_ADDRESS:8443",
      "username": "YOUR_USERNAME",
      "password": "YOUR_PASSWORD",
      "ports": {
          "aa:bb:cc:dd:ee:ff": [1]
      }
    }
  ]
}
```

Note that by default the controller runs on port 443 instead of 8443 for UDM devices.
