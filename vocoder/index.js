// If you hear nothing, use the parameter -i 2.
const el = require('@nick-thompson/elementary');


// helper function to add more than 8 signals (el.add has a limit of 8)
const bigAdd = xs => {
  const partitions = xs.reduce((partition, value, index) => {
        if (index % 8 == 0)
          return partition.concat([[value]]);
        else {
          partition[partition.length-1].push(value);
          return partition;
        }
      }, []);
  return el.add(partitions.map(part => el.add(part)));
}


// Constants defining the vocoder.

const nrChannels = 12; // number of channels
const baseChannel = nrChannels/2; // number of additional low-frequency channels not used
const maxFreq = 10000; // frequency of the highest channel
const q = 3; // Q of the bandpass filters
const envelopeSmoothing = 0.02; // the 'attack' and 'release' time (in seconds) of the envelope follower.

// Vocoder functions.

// The center frequency of the band-pass filter for the lowest channel
const baseFreq = Math.pow(maxFreq, 1/(baseChannel+nrChannels-1));

// band-pass filter for channel k, 0 <= k < nrChannels
const bandpassFilter = (k) => {
  const fc = Math.pow(baseFreq, k + baseChannel);
  console.log(`${k} => bandpass fc=${Math.round(fc)} q=${q} bandwidth=${Math.round(fc/q)}`);
  return x => el.mul(nrChannels, q, el.bandpass(fc, q, x));
};

// array of bandpass filters for all channels
const bandpassFilters = Array.from({length:nrChannels}, (v,k) => bandpassFilter(k));

// envelope follower using one-pole
const envelopeFollower = x => el.smooth(el.tau2pole(envelopeSmoothing), el.abs(x));

// the vocoder uses a modulator (voice) and a carrier (synth, noise, ...)
const vocoder = (modulator, carrier) =>
  bigAdd(bandpassFilters.map(bpf => el.mul(envelopeFollower(bpf(modulator)), bpf(carrier))));


// midi synthesizer, based on the Elementary examples

const M3 = Math.pow(2, 4/12);
const P5 = Math.pow(2, 7/12);

function voice(freq, delta) {
  return el.mul(
    el.const({value: 1.0 / 7.0}),
    el.add(
      el.blepsaw(el.const({key: 'v1f', value: 0.5 * freq + delta * Math.random()})),
      el.blepsaw(el.const({key: 'v2f', value: freq + delta * Math.random()})),
      el.blepsaw(el.const({key: 'v3f', value: freq + delta * Math.random()})),
      el.blepsaw(el.const({key: 'v4f', value: M3 * freq + delta * Math.random()})),
      el.blepsaw(el.const({key: 'v5f', value: M3 * freq + delta * Math.random()})),
      el.blepsaw(el.const({key: 'v6f', value: P5 * freq + delta * Math.random()})),
      el.blepsaw(el.const({key: 'v7f', value: P5 * freq + delta * Math.random()})),
    )
  );
}


// Use the microphone as the modulator and the synth as the carrier.

elementary.core.on('load', function() {
  // Midi receiver
  elementary.core.on('midi', function(e) {
    if (e && e.hasOwnProperty('type') && e.type === 'noteOn') {
      const carrierfreQ = e.noteFrequency;
      console.log(`freq=${carrierfreQ}`);
      // Render the vocoder.
      elementary.core.render(
        vocoder(el.in({channel: 0}), voice(carrierfreQ, 8)),
        vocoder(el.in({channel: 1}), voice(carrierfreQ, 8))
      );
    }
  });
});
