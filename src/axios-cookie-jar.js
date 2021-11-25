const axios = require('axios');
const { CookieJar } = require('tough-cookie');
const combineURLs = require('axios/lib/helpers/combineURLs');

module.exports = function (config = {}) {
  const client = axios.create(config);

  return client;
};

module.exports = function (axios) {
  axios.cookieJar = new CookieJar;

  axios.interceptors.request.use((config) => {
    let url = combineURLs(config.baseURL, config.url);
    config.headers.cookie = axios.cookieJar.getCookieStringSync(url);

    return config;
  });

  axios.interceptors.response.use((response) => {
    let url = combineURLs(response.config.baseURL, response.config.url);

    let setCookie = response.headers['set-cookie'];
    if (setCookie) {
      setCookie = Array.isArray(setCookie) ? setCookie : [setCookie];

      for (let cookie of setCookie) {
        axios.cookieJar.setCookieSync(cookie, url);
      }
    }

    return response;
  });
};
