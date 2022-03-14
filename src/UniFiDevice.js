const { Service, Characteristic } = require('./types');
const { debounce } = require('lodash');

module.exports = class UniFiDevice {
  constructor(plugin, homeKitAccessory) {
    this.plugin = plugin;
    this.homeKitAccessory = homeKitAccessory;

    this.changePending = false;
    this._debouncedSetAllProperties = debounce(this._setAllProperties, 1000);

    this._hookCharacteristics();
  }

  _hookCharacteristics() {
    this.getCharacteristic(Characteristic.On).on('set', this.set.bind(this));
  }

  get site() {
    return this.homeKitAccessory.context.site;
  }

  get mac() {
    return this.homeKitAccessory.context.mac;
  }

  get device_id() {
    return this.homeKitAccessory.context.device_id;
  }

  get port_onMode() {
    return this.homeKitAccessory.context.port_onMode;
  }

  get port_idx() {
    return this.homeKitAccessory.context.port_idx;
  }

  matches(device, devicePortConfig) {
    return (
      this.mac === device.mac &&
      this.port_idx === devicePortConfig.idx &&
      this.port_onMode === devicePortConfig.onMode
    );
  }

  static getContextForDevicePort(site, device, devicePortConfig) {
    return {
      site,
      mac: device.mac,
      device_id: device.device_id,
      port_onMode: devicePortConfig.onMode,
      port_idx: devicePortConfig.idx
    };
  }

  async update(site, device, port, devicePortConfig) {
    this.homeKitAccessory.context = UniFiDevice.getContextForDevicePort(site, device, devicePortConfig);

    this.homeKitAccessory.getService(Service.AccessoryInformation)
      .setCharacteristic(Characteristic.Name, devicePortConfig.name)
      .setCharacteristic(Characteristic.Manufacturer, 'Stefan Kienzle')
      .setCharacteristic(Characteristic.Model, device.name || device.model)
      .setCharacteristic(Characteristic.SerialNumber, devicePortConfig.mac + '-' + devicePortConfig.idx + (devicePortConfig.onMode === 'power_cycle' ? '-pc' : ''));

    if (this.port_onMode === 'power_cycle') {
      this.getCharacteristic(Characteristic.On).updateValue(false);
    }

    if (!this.changePending) {
      if (this.port_onMode !== 'power_cycle') {
        this.getCharacteristic(Characteristic.On).updateValue(port.poe_mode !== 'off');
      }
    }
  }

  getService() {
    let service = this.homeKitAccessory.getService(Service.Switch);

    if (!service) {
      service = this.homeKitAccessory.addService(Service.Switch);
    }

    return service;
  }

  getCharacteristic(characteristic) {
    return this.getService().getCharacteristic(characteristic);
  }

  async _setAllProperties() {
    let port_override = {};
    let port = {};
    let devices, foundDevice;

    // Refresh devices to get current port_overrides
    try {
      devices = await this.plugin.client.getDevices(this.site.name);
      foundDevice = devices.data.find(device => device.mac === this.mac);
    } catch (e) {};

    if (!foundDevice) {
      this.plugin.log.warn(`Device (ID: ${this.device_id}, MAC: ${this.mac}) doesn't exists`);
      this.changePending = false;
      return await this.plugin.refreshDevices();
    }

    port = foundDevice.port_table.find(port => port.port_idx === this.port_idx, this);

    if (Array.isArray(foundDevice.port_overrides)) {
      port_override = foundDevice.port_overrides.find(port_override => port_override.port_idx === this.port_idx, this);
    }

    // Just power cycle the port - no change to port config
    if (this.port_onMode === 'power_cycle') {
      let poePortEnabled;

      if (port_override) {
        poePortEnabled = port_override.poe_mode !== 'off';
      } else {
        poePortEnabled = port.poe_mode !== 'off';
      }

      if (!poePortEnabled) {
        this.plugin.log.info(`Device (ID: ${this.device_id}, MAC: ${this.mac}): Power Cycle not available - POE is turned off`);
        this.changePending = false;
        
        // Reset characteristic value - is always "false"
        this.getCharacteristic(Characteristic.On).updateValue(false);

        return;
      }

      let properties = {
        'mac': this.mac,
        'port_idx': `${this.port_idx}`,
        'cmd': 'power-cycle'
      };

      this.changePending = false;

      return this.setPowerCycle(properties);

    // Change port config to new poe_mode value
    } else {
      let port_overrides = foundDevice.port_overrides || [];

      if (port_override) {
        port_override.poe_mode = this.getCharacteristic(Characteristic.On).value ? this.port_onMode : 'off';
      } else {
        port_overrides.push({
          port_idx: port.port_idx,
          portconf_id: port.portconf_id,
          poe_mode: this.getCharacteristic(Characteristic.On).value ? this.port_onMode : 'off'
        });
      }

      let properties = {
        port_overrides: port_overrides,
        device_id: this.device_id
      };

      this.changePending = false;

      return this.setProperties(properties);
    }
  }

  async setProperties(properties) {
    this.plugin.log.info(`Device (ID: ${this.device_id}, MAC: ${this.mac}): Update "port_overrides"`);

    try {
      await this.plugin.client.setDevice(this.site.name, this.device_id, properties);
    } catch (e) {
      this.plugin.log.error(e);
      if (e.response) {
        this.plugin.log.error(e.response.data);
      }
    }
  }

  async setPowerCycle(properties) {
    this.plugin.log.info(`Device (ID: ${this.device_id}, MAC: ${this.mac}): Command "power_cycle"`);
    
    // Reset characteristic value - is always "false"
    this.getCharacteristic(Characteristic.On).updateValue(false);

    try {
      await this.plugin.client.setPowerCycle(this.site.name, properties);
    } catch (e) {
      this.plugin.log.error(e);
      if (e.response) {
        this.plugin.log.error(e.response.data);
      }
    }
  }

  set(value, callback) {
    this.changePending = true;
    this._debouncedSetAllProperties();
    callback();
  }
};
