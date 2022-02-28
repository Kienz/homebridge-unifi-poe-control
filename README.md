# homebridge-unifi-poe-control
Adds UniFi device POE control to HomeKit via Homebridge

## Configuration

Use the settings UI in Homebridge Config UI X to configure your controller URL, account details and POE ports, or manually add the following to the platforms section of your config file:

```js
{
  "platforms": [
    {
      "platform": "UniFiPoeControl",
      "name": "UniFi POE",
      "url": "https://CONTROLLER_ADDRESS:8443",
      "username": "YOUR_USERNAME",
      "password": "YOUR_PASSWORD",
      "refreshInterval": 60 // seconds - optional
      "apiMode": null, // optional
      "ports": {
          [{
            "mac": "aa:bb:cc:dd:ee:ff",
            "idx": 17,
            "name": "ALTERNATIVE NAME",  // optional
            "onMode": "auto" // optional
          }]
      }
    }
  ]
}
```

Note that by default the controller runs on port 443 instead of 8443 for UDM devices.
