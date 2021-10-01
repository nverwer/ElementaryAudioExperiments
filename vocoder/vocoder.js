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
 * - settings {nrChannels, q} : settings object for the filter
 * - k integer : channel number
 * Returns a low-pass filter for k = 0, high-pass filter for k = nrChannels-1 and band-pass filter for 0 < k < nrChannels-1
 * The cutoff / center frequencies fc(k) are exponentially spaced.
 */
const channelFilter = (settings) => {
  const baseFreq = Math.pow(settings.maxFreq / settings.minFreq, 1 / (settings.nrChannels - 1));
  const baseChannel = Math.log(settings.minFreq) / Math.log(baseFreq);
  return (k) => {
    const fc = Math.pow(baseFreq, baseChannel + k);
    const boost = 3 * Math.sqrt(settings.nrChannels); // seems okay to preserve volume
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
};


/**
 * envelope follower using one-pole smoothing
 * sometimes it is useful to suppress low amplitudes by raising the output to a power between 1 and 2 (not implemented).
 */
const envelopeFollower = (envelopeSmoothing) =>
  (x) => el.smooth(el.tau2pole(envelopeSmoothing), el.abs(x));

/**
 * Determine if speech is voiced or unvoiced.
 * - channelAmplitudes [] : The amplitudes of each of the channels
 * Returns 1 for voiced speech, 0 for unvoiced speech.
 */
const voicedUnvoiced = (channelAmplitudes) => {
  const oneThirdNrChannels = Math.floor(channelAmplitudes.length/3);
  const oneFourthNrChannels = Math.floor(channelAmplitudes.length/4)
  // Use two subsets of the channelAmplitudes for voiced-unvoiced detection.
  const lowChannels = channelAmplitudes.slice(0, oneThirdNrChannels);
  const lowChannelsAmplitude = el.div(el.add(lowChannels), oneThirdNrChannels);
  const highChannels = channelAmplitudes.slice(-oneFourthNrChannels);
  const highChannelsAmplitude = el.div(el.add(highChannels), oneFourthNrChannels);
  return el.ge(lowChannelsAmplitude, highChannelsAmplitude);
};


/**
 * the vocoder uses a modulator (voice) and a carrier (synth, noise, ...)
 * - settings {nrChannels, minFreq, maxFreq, q, envelopeSmoothing} : settings overriding the defaults
 */
const vocoder = (settings) => {
  // use default settings or override them
  settings = Object.assign({}, defaults, settings);
  console.log(`vocoder settings: ${JSON.stringify(settings)}`);
  // create the filter array for the channel 0 .. nrChannels-1
  const channelFilters = em.range(settings.nrChannels).map(k => channelFilter(settings)(k));
  const channelEnvelope = envelopeFollower(settings.envelopeSmoothing);
  return (modulator, carrier) => {
    // Split the modulator into channels and take the envelopes.
    const channelAmplitudes = channelFilters.map(filter => channelEnvelope(filter(modulator)));
    const IsVoicedUnvoiced = voicedUnvoiced(channelAmplitudes);
    // Add noise to the carrier for unvoiced speech.
    const voicedUnvoicedCarrier = el.select(IsVoicedUnvoiced, carrier, el.add(carrier, el.mul(0.5, el.noise())));
    // Split the carrier into channels.
    const channelCarriers = channelFilters.map(filter => filter(voicedUnvoicedCarrier));
    // Apply per-channel modulation to the carrier and add the outputs.
    return em.extend(el.add)(em.zipWith(el.mul, channelAmplitudes, channelCarriers));
  };
};


exports.vocoder = vocoder;
