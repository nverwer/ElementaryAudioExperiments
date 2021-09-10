const el = require('@nick-thompson/elementary');
const em = require('../em');


/**
 * Default parameters that define the vocoder.
 */
const defaults = {
  nrChannels: 12, // number of channels into which the modulator and carrier are split
  maxFreq: 10000, // frequency of the highest channel (Hz)
  q: 2, // Q of the bandpass filters
  envelopeSmoothing: 0.02 // 'attack' and 'release' time (in seconds) of the envelope follower
};


/**
 * band-pass filter for channel k, 0 <= k < nrChannels
 * - bpf {nrChannels, maxFreq, q} : settings object for the filter
 * - k integer : channel number
 * returns a parameterized band-pass filter
 */
const bandpassFilter = (bpf) =>
  (k) => {
    // number of unused low-frequency channels below the lowest channel
    const baseChannel = bpf.nrChannels / 2;
    // The center frequency of the band-pass filter for the lowest channel
    const baseFreq = Math.pow(bpf.maxFreq, 1 / (baseChannel + bpf.nrChannels - 1));
    // The center frequencies fc(k) are exponentially spaced.
    const fc = Math.pow(baseFreq, k + baseChannel);
    console.log(`vocoder channel ${k}: fc=${Math.round(fc)} q=${bpf.q} bandwidth=${Math.round(fc/bpf.q)}`);
    // Multiply the output of the filter by q and the number of channels, to boost the output.
    return x => el.mul(bpf.nrChannels, bpf.q, el.bandpass(fc, bpf.q, x));
  };


/**
 * array of bandpass filters for all channels
 * - bpf {nrChannels, maxFreq, q} : settings object for the filter
 * returns an array of band-pass filters
 */
const bandpassFilters = (bpf) =>
  em.range(bpf.nrChannels).map(k => bandpassFilter(bpf)(k));


/**
 * envelope follower using one-pole smoothing
 * Low amplitudes are suppressed by raising the output to a power greater than 1.
 */
const envelopeFollower = (envelopeSmoothing) =>
  (x) => el.pow(el.smooth(el.tau2pole(envelopeSmoothing), el.abs(x)), 1.5);


/**
 * the vocoder uses a modulator (voice) and a carrier (synth, noise, ...)
 * - settings {nrChannels, maxFreq, q, envelopeSmoothing} : settings overriding the defaults
 */
const vocoder = (settings) => {
  settings = Object.assign({}, defaults, settings);
  const channelFilters = bandpassFilters(settings);
  const channelVCA = envelopeFollower(settings.envelopeSmoothing);
  return (modulator, carrier) => {
    return em.extend(el.add)(channelFilters.map(bpf => el.mul(channelVCA(bpf(modulator)), bpf(carrier))));
  };
};


exports.vocoder = vocoder;
