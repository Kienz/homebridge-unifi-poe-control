const { homebridge, Accessory, UUIDGen } = require('./types');
const UniFiAPI = require('./UniFiAPI');
const UniFiDevice = require('./UniFiDevice');
const { size, find } = require('lodash');

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
    this.log.info('Refreshing devices...');

    try {
      let sites = await this.client.getSites();

      for (let site of sites.data) {
        let devices = await this.client.getDevices(site.name);

        await this.loadDevices(site, devices.data);
      }
    } catch (e) {
      this.log.error(`Error getting devices: ${e}`);
      throw e;
    }
  }

  async loadDevices(site, devices) {
    let foundAccessories = [];

    for (let device of devices) {
      this.log.debug('Find matching devices and ports...');
      if (size(this.config.ports[device.mac]) > 0) {
        this.log.debug(`Found matching device: ${device.model} / ${device.name} (MAC: ${device.mac})`);

        for (let port of device.port_overrides) {
          let devicePortConfig = find(this.config.ports[device.mac], {idx: port.port_idx});
          if (devicePortConfig) {
            port.name = devicePortConfig.name || port.name;
            port.onMode = port.onMode || 'auto';

            this.log.debug(`Found device port: ${device.model} / ${device.name} (MAC: ${device.mac}) / #${port.port_idx}${port.name ? ' (' + port.name  + ')' : ''}`);

            let accessory = await this.loadDevicePort(site, device, port);  
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

  async loadDevicePort(site, device, port) {
    let accessory = this.accessories.find(a => a.matches(device, port));

    if (!accessory) {
      this.log.info(`Setting up new accessory: ${device.model} (MAC: ${device.mac}) / #${port.port_idx} (${port.name})`);
      let homeKitAccessory = this.createHomeKitAccessory(site, device, port);
      accessory = new UniFiDevice(this, homeKitAccessory);
      this.accessories.push(accessory);
    } else {
      this.log.info(`Update existing accessory`);
      accessory.homeKitAccessory = updateHomeKitAccessory(accessory.homeKitAccessory, site, device, port);
    }

    await accessory.update(site, device, port);

    return accessory;
  }

  createHomeKitAccessory(site, device, port) {
    let uuid = UUIDGen.generate(device.mac + port.port_idx);
    let homeKitAccessory = new Accessory(port.name || device.name + ' #' + port_idx, uuid);
    homeKitAccessory.context = UniFiDevice.getContextForDevicePort(site, device, port);
    this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [homeKitAccessory]);
    return homeKitAccessory;
  }

  updateHomeKitAccessory(homeKitAccessory, site, device, port) {
    homeKitAccessory.context = UniFiDevice.getContextForDevicePort(site, device, port);
    this.api.updatePlatformAccessories([homeKitAccessory]);
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
