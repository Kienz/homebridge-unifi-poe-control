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

  get port_idx() {
    return this.homeKitAccessory.context.port_idx;
  }

  matches(device, port) {
    return (
      this.mac === device.mac &&
      this.port_idx === port.port_idx
    );
  }

  static getContextForDevicePort(site, device, port) {
    return {
      site,
      mac: device.mac,
      device_id: device.device_id,
      port_overrides: device.port_overrides,
      port_idx: port.port_idx
    };
  }

  async update(site, device, port) {
    this.homeKitAccessory.context = UniFiDevice.getContextForDevicePort(site, device, port);

    this.homeKitAccessory.getService(Service.AccessoryInformation)
      .setCharacteristic(Characteristic.Name, port.name || device.name || device.model)
      .setCharacteristic(Characteristic.Manufacturer, 'Ubiquiti')
      .setCharacteristic(Characteristic.Model, device.name || device.model)
      .setCharacteristic(Characteristic.SerialNumber, device.mac + '-' + port.port_idx);

    if (!this.changePending) {
      this.getCharacteristic(Characteristic.On).updateValue(port.poe_mode !== 'off');
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
    for (let override of this.port_overrides) {
      if (override.port_idx === this.port_idx) {
        override.poe_mode = this.getCharacteristic(Characteristic.On).value ? 'auto' : 'off'
      }
    }

    let properties = {
      port_overrides: this.port_overrides,
      device_id: this.device_id
    };

    this.changePending = false;

    return this.setProperties(properties);
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

  set(value, callback) {
    this.changePending = true;
    this._debouncedSetAllProperties();
    callback();
  }
};
