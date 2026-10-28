import type { AudioEngine } from '../../audio/AudioEngine';
import { chordTones } from '../../audio/chords';
import { STEP_NOTE_SECONDS } from '../../audio/constants';
import { stepDuration } from '../../audio/scheduler';
import { midiToFrequency } from '../../audio/notes';
import type { Challenge } from './types';

export async function previewChallengeTarget(
  challenge: Challenge,
  audio: AudioEngine,
): Promise<boolean> {
  if (audio.snapshot().silent) {
    return false;
  }
  const started = await audio.start();
  if (!started) {
    return false;
  }

  const target = challenge.target;
  const now = audio.currentTime + 0.03;
  let played = 0;

  if (challenge.concept === 'pitch') {
    played += play(audio, {
      frequency: target.frequency ?? 440,
      waveform: 'sine',
      level: 0.45,
      duration: 0.9,
      when: now,
    });
  } else if (challenge.concept === 'waveform') {
    played += play(audio, {
      frequency: target.frequency ?? 220,
      waveform: target.waveform ?? 'sine',
      level: 0.45,
      duration: 0.9,
      when: now,
    });
  } else if (challenge.concept === 'harmonics') {
    const gains = target.harmonics ?? [1, 0, 0, 0];
    played += play(audio, {
      frequency: target.fundamental ?? 220,
      waveform: 'sine',
      partials: gains.map((gain, index) => ({ multiple: index + 1, gain })),
      level: 0.5,
      duration: 1,
      when: now,
    });
  } else if (challenge.concept === 'chord') {
    const chord = target.chord;
    if (chord) {
      for (const tone of chordTones(chord.rootMidi, chord.quality)) {
        played += play(audio, {
          frequency: tone.frequency,
          waveform: 'sine',
          level: 0.3,
          duration: 1.1,
          when: now,
        });
      }
    }
  } else if (challenge.concept === 'rhythm') {
    const steps = target.pattern ?? [];
    const bpm = target.bpm ?? 120;
    const seconds = stepDuration(bpm);
    steps.forEach((midi, index) => {
      if (midi === null) {
        return;
      }
      played += play(audio, {
        frequency: midiToFrequency(midi),
        waveform: 'triangle',
        level: 0.38,
        duration: STEP_NOTE_SECONDS,
        attack: 0.005,
        release: 0.08,
        when: now + index * seconds,
      });
    });
  }

  return played > 0;
}

function play(audio: AudioEngine, spec: Parameters<AudioEngine['playVoice']>[0]): number {
  return audio.playVoice(spec) ? 1 : 0;
}
