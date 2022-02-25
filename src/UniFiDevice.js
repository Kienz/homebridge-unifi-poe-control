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

  get port_overrides() {
    return this.homeKitAccessory.context.port_overrides;
  }

  get port_onMode() {
    return this.homeKitAccessory.context.port_onMode;
  }

  get port_idx() {
    return this.homeKitAccessory.context.port_idx;
  }

  matches(device, port, devicePortConfig) {
    return (
      this.mac === device.mac &&
      this.port_idx === port.port_idx &&
      this.port_onMode === devicePortConfig.onMode
    );
  }

  static getContextForDevicePort(site, device, port, devicePortConfig) {
    return {
      site,
      mac: device.mac,
      device_id: device.device_id,
      port_overrides: device.port_overrides,
      port_onMode: devicePortConfig.onMode,
      port_idx: port.port_idx
    };
  }

  async update(site, device, port, devicePortConfig) {
    this.homeKitAccessory.context = UniFiDevice.getContextForDevicePort(site, device, port, devicePortConfig);

    this.homeKitAccessory.getService(Service.AccessoryInformation)
      .setCharacteristic(Characteristic.Name, devicePortConfig.name || port.name || device.name + ' - Port ' + port.port_idx)
      .setCharacteristic(Characteristic.Manufacturer, 'Stefan Kienzle')
      .setCharacteristic(Characteristic.Model, device.name || device.model)
      .setCharacteristic(Characteristic.SerialNumber, device.mac + '-' + port.port_idx + (devicePortConfig.onMode === 'power_cycle' ? '-pc' : ''));

    if (!this.changePending) {
      if (this.port_onMode === 'power_cycle') {
        this.getCharacteristic(Characteristic.On).updateValue(false);
      } else {
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

  _setAllProperties() {
    // Just power cycle the port - no change to port config
    if (this.port_onMode === 'power_cycle') {
      let poePortEnabled = false;

      for (let override of this.port_overrides) {
        if (override.port_idx === this.port_idx) {
          poePortEnabled = override.poe_mode !== 'off';
        }
      }

      if (!poePortEnabled) {
        this.plugin.log.info(`Device ${this.device_id}: Power Cycle not available - POE is turned off`);
        this.changePending = false;
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
      for (let override of this.port_overrides) {
        if (override.port_idx === this.port_idx) {
          override.poe_mode = this.getCharacteristic(Characteristic.On).value ? this.port_onMode : 'off'
        }
      }

      let properties = {
        port_overrides: this.port_overrides,
        device_id: this.device_id
      };

      this.changePending = false;

      return this.setProperties(properties);
    }
  }

  async setProperties(properties) {
    this.plugin.log.info(`Device ${this.device_id}: Setting properties: ${JSON.stringify(properties)}`);

    try {
      await this.plugin.client.setDevice(this.site.name, this.device_id, properties);
    } catch (e) {
      this.plugin.log.error(e);
      this.plugin.log.error(e.response.data);
    }
  }

  async setPowerCycle(properties) {
    this.plugin.log.info(`Device ${this.device_id}: Power Cylce: ${JSON.stringify(properties)}`);

    try {
      await this.plugin.client.setPowerCycle(this.site.name, properties);
    } catch (e) {
      this.plugin.log.error(e);
      this.plugin.log.error(e.response.data);
    }
  }

  set(value, callback) {
    this.changePending = true;
    this._debouncedSetAllProperties();
    callback();
  }
};
