const el = require('@nick-thompson/elementary');
const em = require('../em');


/**
 * Default parameters that define the vocoder.
 */
const defaults = {
  nrChannels: 14, // number of channels into which the modulator and carrier are split
  minFreq: 70, // frequency of the lowest channel (Hz)
  maxFreq: 10000, // frequency of the highest channel (Hz)
  q: 3, // Q of the bandpass filters
  envelopeSmoothing: 0.02 // 'attack' and 'release' time (seconds) of the envelope follower
};


/**
 * filter for channel k, 0 <= k < nrChannels
 * - settings {nrChannels, baseFreq, baseChannel, q} : settings object for the filter
 * - k integer : channel number
 * returns a low-pass filter for k = 0, high-pass filter for k = nrChannels-1 and band-pass filter for 0 < k < nrChannels-1
 * The cutoff / center frequencies fc(k) are exponentially spaced.
 */
const channelFilter = (settings) =>
  (k) => {
    const fc = Math.pow(settings.baseFreq, settings.baseChannel + k);
    const boost = 3 * Math.sqrt(settings.nrChannels); // seems okay
    if (k == 0) {
      console.log(`vocoder channel ${k}: fc=${Math.round(fc)}`);
      return x => el.mul(boost, el.lowpass(fc, settings.q, x));
    } else if (k == settings.nrChannels - 1) {
      console.log(`vocoder channel ${k}: fc=${Math.round(fc)}`);
      return x => el.mul(boost, el.highpass(fc, settings.q, x));
    } else {
      console.log(`vocoder channel ${k}: fc=${Math.round(fc)} bandwidth=${Math.round(fc/settings.q)}`);
      return x => el.mul(boost, el.bandpass(fc, settings.q, x));
    }
  };


/**
 * envelope follower using one-pole smoothing
 * sometimes it is useful to suppress low amplitudes by raising the output to a power between 1 and 2 (not implemented).
 */
const envelopeFollower = (envelopeSmoothing) =>
  (x) => el.smooth(el.tau2pole(envelopeSmoothing), el.abs(x));


/**
 * the vocoder uses a modulator (voice) and a carrier (synth, noise, ...)
 * - settings {nrChannels, minFreq, maxFreq, q, envelopeSmoothing} : settings overriding the defaults
 */
const vocoder = (settings) => {
  // use default settings or override them
  settings = Object.assign({}, defaults, settings);
  // add some additional settings
  settings.baseFreq = Math.pow(settings.maxFreq / settings.minFreq, 1 / (settings.nrChannels - 1));
  settings.baseChannel = Math.log(settings.minFreq) / Math.log(settings.baseFreq);
  console.log(`vocoder settings: ${JSON.stringify(settings)}`);
  // create the filter array for the channel 0 .. nrChannels-1
  const channelFilters = em.range(settings.nrChannels).map(k => channelFilter(settings)(k));
  const channelVCA = envelopeFollower(settings.envelopeSmoothing);
  return (modulator, carrier) => {
    const channelAmplitudes = channelFilters.map(filter => channelVCA(filter(modulator)));
    const channelCarriers = channelFilters.map(filter => filter(carrier));
    return em.extend(el.add)(em.zipWith(el.mul, channelAmplitudes, channelCarriers));
  };
};
/* The following experiment to add noise for unvoiced speech does not work well.
    const lowChannelsAmplitude = el.add(channelAmplitudes.slice(0, Math.floor(settings.nrChannels/3)));
    const highChannelsAmplitude = el.add(channelAmplitudes.slice(Math.floor(settings.nrChannels*3/4), settings.nrChannels-1));
    const voicedUnvoicedCarrier = el.select(el.ge(lowChannelsAmplitude, highChannelsAmplitude),
                                            carrier, el.add(carrier, el.noise()));
*/


exports.vocoder = vocoder;
