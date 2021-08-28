// If you hear nothing, use the parameter -i 2.
const el = require('@nick-thompson/elementary');

// Constants defining the vocoder.

const baseChannel = 4;
const nrChannels = 8;
const maxFreq = 10000;
const q = 8;
const envelopeFreq = 50;

// Vocoder functions.

const baseFreq = Math.pow(maxFreq, 1/(baseChannel+nrChannels));

const bandpassFilter = (k) => {
  const fc = Math.pow(baseFreq, k);
  console.log(`${k} => bandpass fc=${Math.round(fc)} q=${q} bandwidth=${Math.round(fc/q)}`);
  return x => el.mul(nrChannels, el.bandpass(fc, q, x));
};

const bandpassFilters = Array.from({length:nrChannels}, (v,k) => bandpassFilter(k+1+baseChannel));

const envelopeFollower = x => el.lowpass(envelopeFreq, 1, el.abs(x));

const vocoder = (modulator, carrier) =>
  el.add(...bandpassFilters.map(bpf => el.mul(envelopeFollower(bpf(modulator)), bpf(carrier))));

// Midi synthesizer, taken from the Elementary examples.

function voice(freq, delta) {
  return el.mul(
    el.const({value: 1.0 / 7.0}),
    el.add(
      el.blepsaw(el.const({key: 'v1f', value: freq + delta * Math.random()})),
      el.blepsaw(el.const({key: 'v2f', value: freq + delta * Math.random()})),
      el.blepsaw(el.const({key: 'v3f', value: freq + delta * Math.random()})),
      el.blepsaw(el.const({key: 'v4f', value: freq + delta * Math.random()})),
      el.blepsaw(el.const({key: 'v5f', value: freq + delta * Math.random()})),
      el.blepsaw(el.const({key: 'v6f', value: freq + delta * Math.random()})),
      el.blepsaw(el.const({key: 'v7f', value: freq + delta * Math.random()})),
    )
  );
}


// Use the microphone as the modulator and the synth as the carries.

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
