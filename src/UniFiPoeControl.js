const { homebridge, Accessory, UUIDGen } = require('./types');
const UniFiAPI = require('./UniFiAPI');
const UniFiDevice = require('./UniFiDevice');

const PLUGIN_NAME = 'homebridge-unifi-poe-control';
const PLATFORM_NAME = 'UniFiPoeControl';

const DEFAULT_REFRESH_INTERVAL = 60000;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = class UniFiPoeControl {
  constructor(log, config, api) {
    this.log = log;
    this.config = config;
    this.api = api;
    this.client = this.getClient();

    this.accessories = [];

    this.api.on('didFinishLaunching', this.didFinishLaunching.bind(this));
  }

  static register() {
    homebridge.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, UniFiPoeControl);
  }

  getClient() {
    return new UniFiAPI({
      url: this.config.url,
      username: this.config.username,
      password: this.config.password,
      apiMode: this.config.apiMode
    }, this.log);
  }

  async didFinishLaunching() {
    await this.client.login();

    this.runLoop();
  }

  async runLoop() {
    const interval = this.config.refreshInterval || DEFAULT_REFRESH_INTERVAL;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        await this.refreshDevices();
      } catch (e) { }

      await delay(interval);
    }
  }

  async refreshDevices() {
    this.log.debug('Refreshing devices...');

    try {
      let sites = await this.client.getSites();

      for (let site of sites.data) {
        let devices = await this.client.getDevices(site.name);

        await this.loadDevices(site, devices.data);
      }
    } catch (e) { }
  }

  async loadDevices(site, devices) {
    let foundAccessories = [];

    for (let device of devices) {
      this.log.debug('Find matching devices and ports...');

      for (let devicePortConfig of this.config.ports) {
        if (devicePortConfig.mac === device.mac) {
          if (Array.isArray(device.port_table)) {

            // Exists port idx in port_table attribute - otherwise the config is wrong
            let port = device.port_table.find(port => port.port_idx === devicePortConfig.idx);

            if (!port) {
              this.log.warn(`Port config is wrong - idx of port doesn't exist in device: ${device.model} / ${device.name} (MAC: ${device.mac})`)
              continue;
            }

            this.log.debug(`Found device port: ${device.model} / ${device.name} (MAC: ${device.mac}) / Port #${port.port_idx}`);

            // Set name attribute to use in HomeKit
            devicePortConfig.name = devicePortConfig.name || (port.name + (devicePortConfig.onMode === 'power_cycle' ? ' - PowerCycle' : ''));

            let accessory = await this.loadDevicePort(site, device, port, devicePortConfig) ;
            if (accessory) {
              foundAccessories.push(accessory);
            }
          }
        }
      }
    }

    let removedAccessories = this.accessories.filter(a => !foundAccessories.includes(a));
    if (removedAccessories.length > 0) {
      this.log.info(`Removing ${removedAccessories.length} device(s)`);
      let removedHomeKitAccessories = removedAccessories.map(a => a.homeKitAccessory);
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, removedHomeKitAccessories);
    }

    this.accessories = foundAccessories;
  }

  async loadDevicePort(site, device, port, devicePortConfig) {
    let accessory = this.accessories.find(a => a.matches(device, devicePortConfig));

    if (!accessory) {
      let homeKitAccessory = this.createHomeKitAccessory(site, device, port, devicePortConfig);
      this.log.info(`Setting up new accessory: ${device.model} (MAC: ${devicePortConfig.mac}) / #${devicePortConfig.idx} (${devicePortConfig.name})`);

      accessory = new UniFiDevice(this, homeKitAccessory);
      this.accessories.push(accessory);
    }

    await accessory.update(site, device, port, devicePortConfig);

    return accessory;
  }

  createHomeKitAccessory(site, device, port, devicePortConfig) {
    let uuid = UUIDGen.generate(devicePortConfig.mac + devicePortConfig.idx + (devicePortConfig.onMode === 'power_cycle' ? 'pc' : ''));
    let homeKitAccessory = new Accessory(devicePortConfig.name, uuid);

    homeKitAccessory.context = UniFiDevice.getContextForDevicePort(site, device, port, devicePortConfig);
    this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [homeKitAccessory]);

    return homeKitAccessory;
  }

  // Homebridge calls this method on boot to reinitialize previously-discovered devices
  configureAccessory(homeKitAccessory) {
    // Make sure we haven't set up this accessory already
    let accessory = this.accessories.find(a => a.homeKitAccessory === homeKitAccessory);

    if (accessory) {
      return;
    }

    accessory = new UniFiDevice(this, homeKitAccessory);
    this.accessories.push(accessory);
  }
};
