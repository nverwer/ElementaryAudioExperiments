// If you hear nothing, use the parameter -i 2.

import {ElementaryNodeRenderer as core, el} from '@nick-thompson/elementary';

import vocoder from './vocoder.js';

// midi synthesizer, based on the Elementary examples

const M3 = Math.pow(2, 4/12);
const P5 = Math.pow(2, 7/12);

const el_pulse = width => x => el.le(el.phasor(x), width);

function voice(freq, delta) {
  const voices = [
//    el_pulse(0.1)(el.const({key: 'v1f', value: 0.5 * freq + delta * Math.random()})),
    el_pulse(0.05)(el.const({key: 'v2f', value: freq})),
//    el_pulse(0.1)(el.const({key: 'v3f', value: freq + delta * Math.random()})),
//    el_pulse(0.1)(el.const({key: 'v4f', value: M3 * freq})),
//    el_pulse(0.1)(el.const({key: 'v5f', value: M3 * freq + delta * Math.random()})),
    el_pulse(0.1)(el.const({key: 'v6f', value: P5 * freq})),
//    el_pulse(0.1)(el.const({key: 'v7f', value: P5 * freq + delta * Math.random()}))
  ];
  return el.mul(
    el.const({value: 1.0 / voices.length}),
    el.add(voices)
  );
}

const myVocoder = vocoder();

function renderVocoder(carrierFreq) {
  const carrier = voice(carrierFreq, 8);
  // Render the vocoder.
  core.render(
    myVocoder(el.in({channel: 0}), carrier),
    //el.in({channel: 0}),
    myVocoder(el.in({channel: 1}), carrier)
    //el.in({channel: 1})
  );
}


// Use the audio input as the modulator and the synth as the carrier.

core.on('load', function() {
  renderVocoder(110);
  core.on('midi', function(e) {
    if (e && e.hasOwnProperty('type') && e.type === 'noteOn') {
      const carrierFreq = e.noteFrequency;
      console.log(`freq=${carrierFreq}`);
      renderVocoder(carrierFreq);
    }
  });
});

core.initialize();
