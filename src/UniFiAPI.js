const axios = require('axios');
const https = require('https');
const axiosCookieJar = require('./axios-cookie-jar');

module.exports = class UniFiAPI {
  constructor(options, log) {
    this.log = log;

    this.url = options.url;
    this.username = options.username;
    this.password = options.password;
    this.apiMode = options.apiMode;

    // Set up local axios instance
    this.axios = axios.create({
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    });
    axiosCookieJar(this.axios);
  }

  async request(method, url, data = null) {
    try {
      return await this._performRequest(method, url, data);
    } catch (e) {
      this.log.error(`Request-Error ${url} ${e}`);

      if ([401, 403].includes(e.response.status)) {
        this.log.debug('Login and try again request');

        // Log in and try again
        await this.login();
        return this._performRequest(method, url, data);
      }
    }
  }

  async _performRequest(method, url, data = null, config = null) {
    let headers = {
      'Content-Type': 'application/json; charset=utf-8'
    };

    if (this.csrf) {
      headers['x-csrf-token'] = this.csrf;
    }

    if (!url || !this.url) {
      this.log.error(`Please define a value for "url" in the config.`);
      return;
    }

    config = {
      method,
      url,
      data,
      baseURL: this.url,
      headers,
      ...config,
    };

    this.log.debug(`Performing request: ${method} ${url}`);
    this.log.debug(`Request config: ${JSON.stringify(config)}`);

    const result = await this.axios(config);

    this.log.debug(`Response: ${JSON.stringify(result.data)}`);

    let csrf = result.headers['x-csrf-token'];
    if (csrf) {
      this.csrf = csrf;
    }

    return result;
  }

  async checkUniFiOS() {
    // Check whether we are connecting to a UniFi OS controller or old controller (CloudKey Gen1, USG).
    // The UniFi OS responds with HTTP code 200 when you peform a GET request to /,
    // while older controllers redirect you to /manage.

    if (this.apiMode === 'UniFiOS') {
      this.isUniFiOS = true;
      return;
    } else if (this.apiMode === 'old') {
      this.isUniFiOS = false;
      return;
    }

    this.isUniFiOS = false;

    try {
      let response = await this._performRequest('GET', '/', null, { maxRedirects: 0, validateStatus: false });

      if (response.status === 200) {
        this.isUniFiOS = true;
      }
    } catch (e) { }
  }

  async login() {
    await this.checkUniFiOS();

    // The api/auth/login will return a 404 if we already have login cookies.
    this.axios.cookieJar.removeAllCookiesSync();

    let url = (this.isUniFiOS) ? 'api/auth/login' : 'api/login';

    try {
      await this._performRequest('POST', url, {
        username: this.username,
        password: this.password,
      });

      this.log.info('Successfully logged in to UniFi controller');
    } catch (e) {
      this.log.error(`Login error ${e} ${url}`);
    }
  }

  _prefixUrl(url) {
    return (this.isUniFiOS) ? `proxy/network/${url}` : url;
  }

  async getSites() {
    let response = await this.request('GET', this._prefixUrl('api/self/sites'));
    return response.data;
  }

  async getDevices(site) {
    let response = await this.request('GET', this._prefixUrl(`api/s/${site}/stat/device`));
    return response.data;
  }

  async setDevice(site, deviceId, data) {
    let response = await this.request('PUT', this._prefixUrl(`api/s/${site}/rest/device/${deviceId}`), data);
    return response.data;
  }

  async setPowerCycle(site, data) {
    let response = await this.request('POST', this._prefixUrl(`api/s/${site}/cmd/devmgr`), data);
    return response.data;
  }
};
