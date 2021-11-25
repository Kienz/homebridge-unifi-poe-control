const axios = require('axios');
const https = require('https');
const axiosCookieJar = require('./axios-cookie-jar');

module.exports = class UniFiAPI {
  constructor(options, log) {
    this.log = log;

    this.url = options.url;
    this.username = options.username;
    this.password = options.password;

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
      this.log.error('Error, logging in and trying again');

      // Log in and try again
      await this.login();
      return this._performRequest(method, url, data);
    }
  }

  async _performRequest(method, url, data = null, config = null) {
    let headers = {};
    if (this.csrf) {
      headers['x-csrf-token'] = this.csrf;
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

  async checkMode() {
    // Check whether we are connecting to a UDM or an older controller.
    // The UDM responds with HTTP code 200 when you peform a GET request to /,
    // while older controllers redirect you to /manage.
    // This detection method was adapted from unifi-poller.

    this.isNewMode = false;

    try {
      let response = await this._performRequest('GET', '/', null, { maxRedirects: 0, validateStatus: false });

      if (response.status === 200) {
        this.isNewMode = true;
      }
    } catch (e) {
      //
    }
  }

  async login() {
    await this.checkMode();

    // The api/auth/login will return a 404 if we already have login cookies.
    this.axios.cookieJar.removeAllCookiesSync();

    let url = (this.isNewMode) ? 'api/auth/login' : 'api/login';

    await this._performRequest('POST', url, {
      username: this.username,
      password: this.password,
    });

    this.log.info('Successfully logged into UniFi controller');
  }

  _prefixUrl(url) {
    return (this.isNewMode) ? `proxy/network/${url}` : url;
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
};
