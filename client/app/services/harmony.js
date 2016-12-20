import Immutable from 'immutable';
import { paramsToQueryString } from '../utils/url';
import { createReader, createWriter } from '../utils/transitImmutableConverter';

/**
  harmony.js defines a interface for Harmony API.

  It exports two functions:

  - get(url, queryParams)
  - TODO post(url, queryParams, body)

  Internally, harmony.js sets the correct headers to the request and
  also extracts the correct CSRF token from the <meta> tag.
 */

/**
   Extracts CSRF token value from a <meta> tag.
   Returns `null` if token doesn't exist or if the environment doesn't have `document` defined.
 */
const csrfToken = () => {
  if (typeof document != 'undefined') {
    const metaTag = document.querySelector('meta[name=csrf-token]');

    if (metaTag) {
      return metaTag.getAttribute('content');
    }
  }

  return null;
};

const reader = createReader();
const writer = createWriter();

const sendRequest = (method, url, queryParams, body) => {
  const harmonyApiUrl = '/harmony_proxy';

  const headers = new Headers({
    'Content-Type': 'application/transit+json',
    Accept: 'application/transit+json',
  });

  const csrf = csrfToken();

  if (csrf) {
    headers.append('X-CSRF-Token', csrf);
  }

  const defaultRequestOpts = {
    headers,
    credentials: 'same-origin',
  };

  const urlWithQuery = harmonyApiUrl + url + paramsToQueryString(queryParams);
  const opts = { ...defaultRequestOpts, method };
  const requestOpts = body ?
        { ...opts, body: writer.write(body) } :
        opts;

  return window.fetch(urlWithQuery, requestOpts)
               .then((response) => {
                 if (response.status >= 200 && response.status < 300) { // eslint-disable-line no-magic-numbers
                   return response.text()
                     .then((text) => reader.read(text))
                     .catch(() => new Error('Transit parsing failed for response.'));
                 }
                 return Promise.reject(new Error(response.statusText));
               });
};

const get = (url, queryParams) =>
  sendRequest('get', url, queryParams);

export const createBlocks = (marketplaceId, refId, blocks) =>
  sendRequest('post', '/bookables/createBlocks', {}, {
    ':marketplaceId': marketplaceId,
    ':refId': refId,
    ':blocks': blocks.map((b) => Immutable.Map({
      ':start': b.get('start').toDate(),
      ':end': b.get('end').toDate(),
    })),
  });

export const deleteBlocks = (marketplaceId, refId, blockIds) =>
  sendRequest('post', '/bookables/deleteBlocks', {}, {
    ':marketplaceId': marketplaceId,
    ':refId': refId,
    ':blocks': blockIds.map((id) => Immutable.Map({
      ':id': id,
    })),
  });

export const showBookable = ({refId, marketplaceId, include, start, end}) =>
  sendRequest('get', '/bookables/show', {
    refId,
    marketplaceId,
    include: (include || []).join(','),
    start: start.toJSON(),
    end: end.toJSON(),
  })
