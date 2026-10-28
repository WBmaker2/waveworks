# WaveWorks — Implementation Plan

**Project name:** WaveWorks
**Folder:** `/Volumes/ External Drive 256G/Dev2/opencode/waveworks`
**Type:** Static educational SPA/PWA
**Runtime AI:** None. No LLM/API calls after build. All sound is synthesized in the browser.
**Target learners:** Grades 3–9 (Korean 초3~중3)
**Subject:** Music and science — waveform, frequency, amplitude, harmonics, chords, rhythm
**MVP duration:** 2–3 weeks

---

## 0. One-page summary

WaveWorks is a sound laboratory where students build tones, stack harmonics, form chords, and program a short rhythm. Every sound is generated with the Web Audio API; there are no audio files, no samples, and no external services.

The app has four connected rooms:

1. **Tone** — one oscillator with waveform, frequency, and volume.
2. **Harmonics** — stack integer multiples of a fundamental and hear timbre change.
3. **Chords** — build major and minor triads on a keyboard.
4. **Rhythm** — program an 8-step pattern and watch the playhead.

A waveform view and a spectrum view run in real time, so students can connect what they hear to what they see.

**Why this is a strong build**

- No 3D assets; the entire app is code and sound.
- Immediate, satisfying feedback.
- Real signal processing and scheduling logic that can be unit-tested.
- Strong cross-curricular fit: music, physics, and math.
- Excellent accessibility story when designed with visual alternatives.

---

## 1. Product definition

### 1.1 Learning problem

Students often treat pitch, loudness, and timbre as vague qualities. They cannot connect frequency to pitch, amplitude to loudness, or harmonics to timbre. Rhythm is often taught by imitation without a model of timing.

### 1.2 Learning goals

By the end of the core challenges, a student should be able to:

- Relate frequency to pitch and amplitude to loudness.
- Identify sine, square, sawtooth, and triangle waveforms by shape and sound.
- Explain how harmonics change timbre.
- Build a major and minor triad from semitone intervals.
- Read and program a simple 8-step rhythm at a given tempo.
- Explain why a short attack/release prevents clicks.

### 1.3 Core learning loop

1. **Predict** — the challenge asks which sound will be higher, brighter, or louder.
2. **Build** — the student changes a waveform, frequency, harmonic, chord, or pattern.
3. **Listen and look** — the waveform and spectrum update.
4. **Explain** — the student answers a short question.
5. **Create** — the student saves a short pattern or chord progression.

### 1.4 Success criteria

- A student can match a target pitch by adjusting frequency.
- A student can build a major triad without a reference.
- A student can explain why a square wave sounds brighter than a sine wave.
- A teacher can reset progress and select challenges without code changes.

---

## 2. Scope

### MVP (must ship)

- One oscillator voice with sine, square, sawtooth, and triangle waveforms.
- Frequency and volume controls with safe limits.
- Short attack/release envelope to prevent clicks.
- Four-harmonic stack with individual gains.
- Major and minor triad builder on an on-screen keyboard.
- 8-step sequencer with note selection and tempo control.
- Real-time waveform and spectrum views.
- Five challenges with prediction gates.
- Master volume guard and a visible hearing-safety notice.
- Local progress and teacher reset.
- Responsive layout, keyboard playable, reduced motion.
- PWA install + offline cache.

### Later (do not build in the first pass)

- Full ADSR envelope editor.
- Multiple tracks and drum synthesis.
- MIDI export or file export.
- Recording and playback of performances.
- Advanced scales and chord extensions.
- Classroom accounts.

### Out of scope

- Any server, database, login, or analytics.
- Any runtime AI or generated music.
- External audio samples or copyrighted music.
- Microphone input or audio recording.
- MIDI hardware support.

---

## 3. Tech stack

| Layer | Choice | Reason |
|---|---|---|
| Build | Vite + TypeScript | Static output, fast iteration |
| Audio | Web Audio API | Native synthesis, no assets |
| Visualization | Canvas 2D | Waveform and spectrum drawing |
| UI | Vanilla DOM + CSS custom properties | Simple, responsive controls |
| Math tests | Vitest | Frequency, intervals, scheduling |
| Browser tests | Playwright | Interaction, audio state, screenshots |
| PWA | `vite-plugin-pwa` | Offline classroom use |
| Hosting | GitHub Pages / Cloudflare Pages | No server |

**Constraints**

- Node.js 20+.
- No backend, no API keys, no runtime network calls.
- No audio files. All sound is synthesized.
- Target 60 fps visualization on a mid-range laptop; ≥ 30 fps on a school tablet.
- Initial gzip bundle under 400 KB.

---

## 4. Architecture

### 4.1 Module map

```text
src/
  main.ts
  app/
    App.ts
    state.ts
    routes.ts
  audio/
    AudioEngine.ts        context, master gain, limiter
    Voice.ts              one synthesized voice
    harmonics.ts          harmonic stack
    notes.ts              note names, MIDI, frequency
    chords.ts             triad intervals
    scheduler.ts          lookahead sequencer
    analyser.ts           waveform and spectrum data
    safety.ts             volume limits and fade ramps
  render/
    WaveformView.ts
    SpectrumView.ts
    Playhead.ts
  ui/
    Knob.ts
    Slider.ts
    PianoKeyboard.ts
    SequencerGrid.ts
    Transport.ts
    VolumeGuard.ts
  features/
    challenges/
    teacher/
  data/
    challenges.json
    scales.json
  storage/
    progress.ts
  tests/
    unit/
    e2e/
```

### 4.2 Audio graph

```text
Voice oscillators
  -> per-voice gain (envelope)
  -> master gain (volume guard)
  -> limiter (DynamicsCompressorNode)
  -> destination

AnalyserNode taps the master bus for visualization.
```

Create one `AudioContext` and reuse it. Do not create a new context per note.

### 4.3 State

```ts
interface AppState {
  route: 'tone' | 'harmonics' | 'chords' | 'rhythm' | 'challenges' | 'teacher';
  tone: {
    waveform: OscillatorType;
    frequency: number;
    volume: number;
  };
  harmonics: {
    fundamental: number;
    gains: [number, number, number, number];
  };
  chord: {
    rootMidi: number;
    quality: 'major' | 'minor';
  };
  rhythm: {
    bpm: number;
    steps: (number | null)[];   // MIDI note per step, 8 steps
    playing: boolean;
  };
  challenge: {
    currentId: string | null;
    answers: Record<string, string>;
    completed: string[];
  };
  preferences: {
    reducedMotion: boolean;
    visualsOnly: boolean;
    masterVolume: number;
  };
}
```

### 4.4 Persistence

- `localStorage` key: `waveworks.progress.v1`.
- Store challenge answers, completed challenges, last pattern, and preferences.
- Do not store audio data.
- No personal data.
- Teacher reset clears progress after confirmation.

---

## 5. Data model

### 5.1 Note and frequency

```ts
interface Note {
  midi: number;       // 69 = A4
  name: string;       // "A4"
  frequency: number;  // Hz
}
```

Frequency formula:

```text
f = 440 × 2^((midi - 69) / 12)
```

### 5.2 Harmonic stack

```ts
interface HarmonicStack {
  fundamental: number;
  harmonics: {
    multiple: number;   // 1, 2, 3, 4
    gain: number;       // 0..1
  }[];
}
```

### 5.3 Chord

```ts
interface ChordDefinition {
  rootMidi: number;
  quality: 'major' | 'minor';
  intervals: number[];   // major [0,4,7], minor [0,3,7]
}
```

### 5.4 Rhythm pattern

```ts
interface RhythmPattern {
  bpm: number;
  steps: (number | null)[];  // 8 steps; null = rest
  stepDivision: 2;           // eighth notes
}
```

### 5.5 Challenge

```ts
interface Challenge {
  id: string;
  titleKo: string;
  concept: 'pitch' | 'waveform' | 'harmonics' | 'chord' | 'rhythm';
  promptKo: string;
  target: {
    frequency?: number;
    waveform?: OscillatorType;
    chord?: { rootMidi: number; quality: 'major' | 'minor' };
    pattern?: (number | null)[];
    bpm?: number;
  };
  tolerance?: number;        // cents or BPM
  explanationKo: string;
  takeawayKo: string;
  difficulty: 1 | 2 | 3;
}
```

### 5.6 Constants

```ts
const A4_HZ = 440;
const MIN_FREQ = 55;        // A1
const MAX_FREQ = 1760;      // A6
const DEFAULT_VOLUME = 0.18;
const MAX_VOLUME = 0.6;
const FADE_SECONDS = 0.01;
const LOOKAHEAD_SECONDS = 0.1;
const SCHEDULER_INTERVAL_MS = 25;
```

Keep constants in one file with units and comments.

---

## 6. Core algorithms

### 6.1 Audio context lifecycle

- Create the `AudioContext` lazily on the first user gesture.
- Show a "Start audio" button if the context is suspended.
- Resume the context on any play action.
- Never autoplay sound on page load; browsers block it and it is bad for classrooms.
- Handle `visibilitychange` by pausing the sequencer when the tab is hidden.

### 6.2 Voice and envelope

Each note creates:

```text
OscillatorNode(s) -> GainNode (envelope) -> master
```

Envelope for the MVP:

- Attack: 5–15 ms linear ramp to the target gain.
- Release: 20–40 ms linear ramp to zero.
- Stop the oscillator after the release.
- Always ramp gain changes; do not set gain directly to zero, or the speaker may click.

For the harmonic stack, create one oscillator per harmonic with its own gain, all sharing the same envelope.

### 6.3 Note frequency and intervals

- Convert MIDI to frequency with the equal-temperament formula.
- Major triad: root, root + 4 semitones, root + 7 semitones.
- Minor triad: root, root + 3 semitones, root + 7 semitones.
- Display note names and frequencies together to connect sound and math.

### 6.4 Harmonics and timbre

- Fundamental at `f`, harmonics at `2f`, `3f`, `4f`.
- Each harmonic has an independent gain.
- A sine wave has only the fundamental; a square/saw contains many harmonics.
- The harmonic stack demonstrates additive synthesis.
- Normalize the sum to avoid clipping; use the master limiter as a second guard.

### 6.5 Sequencer scheduling

Use a lookahead scheduler:

```text
every 25 ms:
  while nextNoteTime < currentTime + 0.1:
    schedule step at nextNoteTime
    advance nextNoteTime by stepDuration
    advance step index
```

- `stepDuration = 60 / bpm / stepDivision`.
- Schedule notes with exact `AudioContext.currentTime` values.
- Do not use `setTimeout` for note timing; it drifts.
- Use `requestAnimationFrame` only for the visual playhead.
- The playhead should read the scheduled step index, not the audio clock directly, to stay in sync.

### 6.6 Waveform and spectrum

- `AnalyserNode.fftSize = 2048`.
- Waveform: `getByteTimeDomainData` and draw a line.
- Spectrum: `getByteFrequencyData` and draw bars or a line.
- Map frequency bins to a log scale for readability.
- Smooth the spectrum with a small decay to avoid flicker.
- In `visualsOnly` mode, show a deterministic animated waveform instead of live audio data.

### 6.7 Volume guard

- Default master volume: 0.18.
- Maximum master volume: 0.6.
- Show a hearing-safety notice on first launch.
- Use a `DynamicsCompressorNode` as a limiter.
- Fade out on route changes and when the tab is hidden.
- Never play more than a small number of voices at once; cap polyphony at 8.

### 6.8 Pitch matching

For pitch challenges, compare the played frequency to the target in cents:

```text
cents = 1200 × log2(f / target)
```

Accept within ±25 cents for a "match" and show the direction (sharp/flat).

---

## 7. Screens and UX

### 7.1 Tone room

- Large waveform selector with four buttons.
- Frequency slider with note name and Hz readout.
- Volume slider with a safe-zone indicator.
- Play/hold button (press and hold, or toggle).
- Live waveform and spectrum.

### 7.2 Harmonics room

- Fundamental note selector.
- Four harmonic sliders with visual bars.
- "Preset timbres" buttons: pure, bright, hollow, custom.
- Live waveform and spectrum.
- A text explanation of why the timbre changes.

### 7.3 Chords room

- On-screen piano keyboard (one octave plus a few notes).
- Root selector and major/minor toggle.
- Play chord button and arpeggio button.
- Note names and semitone intervals displayed.
- A small chord history strip.

### 7.4 Rhythm room

- 8-step grid with note selection.
- Tempo slider (60–160 BPM).
- Play/stop and clear.
- Moving playhead.
- A simple metronome toggle.

### 7.5 Challenge screen

- Challenge card with a prediction question.
- The relevant room opens with a target.
- The student adjusts and submits.
- Feedback shows the target and the student's value.
- Completion award and takeaway.

### 7.6 Teacher mode

- Select challenges.
- Show answers and explanations.
- Reset progress.
- Set a maximum master volume for the class.
- Toggle visuals-only mode for silent classrooms.

### 7.7 Responsive layout

**Desktop (≥ 1024 px)**

- Controls on the left, visualization on the right, keyboard at the bottom.

**Tablet (768–1023 px)**

- Two-column layout with larger touch targets.
- Sequencer grid fits without horizontal scrolling.

**Phone (< 768 px)**

- Single column; visualization collapses to a compact strip.
- Piano keyboard scrolls horizontally.
- Sequencer steps become a 4×2 grid.
- Sticky play/stop button.

### 7.8 Accessibility

- The piano is playable with the computer keyboard (e.g. `A W S E D F T G Y H U J`).
- Every sound has a visual counterpart: waveform, spectrum, note name, frequency.
- `visualsOnly` mode lets deaf and hard-of-hearing students complete challenges by matching numerical/visual targets.
- Respect `prefers-reduced-motion`: no pulsing animations; keep the playhead.
- Use color-blind-safe palette and line styles for waveforms.
- Volume controls have numeric input, not only a slider.
- Provide captions for any explanatory animation.

---

## 8. Implementation milestones

### M0 — Setup (0.5 day)

- Scaffold Vite + TypeScript.
- Add Vitest, Playwright, ESLint, Prettier, PWA plugin.
- Create the module map and a blank page.
- **Verify:** dev server, build, and tests run.

### M1 — Audio engine (2–3 days)

- Implement the audio context lifecycle and master gain/limiter.
- Implement one oscillator voice with a short envelope.
- Implement frequency conversion and note names.
- Write unit tests for frequency and interval math.
- **Verify:** a note plays only after a user gesture; no clicks on start/stop.

### M2 — Tone room (2 days)

- Build the waveform selector, frequency slider, volume slider, and play control.
- Add the waveform and spectrum views.
- Add the volume guard and hearing-safety notice.
- **Verify:** all four waveforms sound distinct; volume never exceeds the cap.

### M3 — Harmonics room (2 days)

- Implement the four-harmonic stack with individual gains.
- Add presets and visualization.
- Write tests for harmonic frequency ratios.
- **Verify:** presets produce visibly different spectra.

### M4 — Chords room (2 days)

- Build the piano keyboard and chord builder.
- Implement major/minor triads and arpeggios.
- Add note names and intervals.
- **Verify:** triads contain the correct frequencies.

### M5 — Rhythm room (2–3 days)

- Implement the lookahead scheduler.
- Build the 8-step grid, tempo control, and playhead.
- Add the metronome.
- Write timing tests with a mocked audio clock.
- **Verify:** 16 bars at 120 BPM do not drift audibly; playhead stays in sync.

### M6 — Challenges and teacher mode (2 days)

- Author five challenges.
- Add prediction gates, target matching, and progress persistence.
- Add teacher reset, volume cap, and visuals-only mode.
- **Verify:** every challenge can be completed from a fresh state.

### M7 — Responsive, accessibility, PWA (2 days)

- Implement the three layouts.
- Add keyboard playing and numeric volume input.
- Add visuals-only mode and reduced motion.
- Configure offline caching.
- **Verify:** keyboard-only challenge completion; offline reload.

### M8 — QA and pilot (1–2 days)

- Run all tests and screenshot checks.
- Test with headphones and with laptop speakers.
- Ask 3–5 students to try the pitch and chord challenges.
- Fix the top usability issues.
- Deploy.
- **Verify:** acceptance criteria below are met.

---

## 9. Testing and verification

### Unit tests (Vitest)

- MIDI 69 = 440 Hz; MIDI 60 = 261.63 Hz (within tolerance).
- Octave doubling.
- Major triad intervals [0, 4, 7]; minor [0, 3, 7].
- Harmonic frequencies 2f, 3f, 4f.
- Cents calculation.
- Step duration at 60, 120, and 160 BPM.
- Scheduler advances the correct number of steps for a given time window.
- Volume clamp and fade values.

### Interaction tests (Playwright)

- Start audio with a user gesture; verify the context state.
- Switch waveforms and confirm the state.
- Change frequency and confirm the readout.
- Build a major and minor chord.
- Program 8 steps and start/stop the sequencer.
- Complete a challenge correctly and incorrectly.
- Reset progress in teacher mode.
- Keyboard-only play and challenge completion.

### Visual tests

- Screenshot each room at desktop, tablet, and phone sizes.
- Screenshot the waveform and spectrum at a stable state.
- Check that the sequencer grid does not overflow on phone.
- Check that the volume warning is visible on first launch.

### Accessibility checks

- `axe-core` scan with no critical issues.
- Keyboard reaches every control and plays notes.
- Focus is visible.
- Visuals-only mode completes a pitch challenge.
- Reduced motion disables pulsing animations.
- Volume slider has a numeric input and a safe-zone label.

### Performance budget

- 60 fps visualization on a mid-range laptop; ≥ 30 fps on a school tablet.
- Audio scheduling runs on a 25 ms timer, not per frame.
- Cap polyphony at 8 voices.
- Pause audio and rendering when the tab is hidden.
- Initial load < 2 s on simulated 4G.

---

## 10. Acceptance criteria / Go-No-Go

- [ ] Sound starts only after a user gesture.
- [ ] All four waveforms play and look distinct.
- [ ] Frequency and note name match the equal-temperament formula.
- [ ] The harmonic stack changes timbre audibly and visually.
- [ ] Major and minor triads contain the correct notes.
- [ ] The 8-step sequencer keeps time at 60–160 BPM.
- [ ] The playhead stays visually in sync.
- [ ] The master volume never exceeds the cap.
- [ ] Five challenges are playable, scored, and saved locally.
- [ ] Teacher reset and volume cap work.
- [ ] Visuals-only mode works.
- [ ] Keyboard-only completion works.
- [ ] The app works offline after the first load.
- [ ] No runtime network calls to an AI service or backend.

If audio timing or volume safety fails, stop and fix it before adding challenges.

---

## 11. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Browser blocks audio until a gesture | No sound on first click | Lazy context creation; explicit "Start audio" button |
| Loud volume hurts students | Safety incident | Default low volume; hard cap; limiter; hearing notice |
| Clicks/pops on note start/stop | Unpleasant and unprofessional | Short attack/release ramps; never set gain directly to 0 |
| Sequencer timing drifts | Rhythm lesson fails | Lookahead scheduler with audio-clock timestamps |
| Too many voices overload the device | Dropouts | Polyphony cap; voice cleanup; limiter |
| Spectrum flickers | Hard to read | Smoothing; fixed frame budget |
| Deaf/hard-of-hearing students cannot participate | Exclusion | Visuals-only mode; waveform/spectrum targets; text feedback |
| Scope creep into a DAW | Delays MVP | One oscillator, four harmonics, one 8-step track |

---

## 12. AI build guide

Use the AI coding agent for scaffolding, audio graph code, visualization, tests, and screenshot-driven fixes. Audio bugs are often timing-related, so require deterministic tests with a mocked clock.

### Recommended build order

1. Scaffold Vite + TypeScript with tests.
2. Implement note/frequency/interval math with tests.
3. Implement the audio engine, one voice, and the envelope.
4. Build the tone room and waveform/spectrum views.
5. Add the harmonic stack.
6. Add the chord builder and keyboard.
7. Implement the lookahead scheduler and rhythm grid with mocked-clock tests.
8. Add challenges and teacher mode.
9. Do responsive/accessibility passes.
10. Use screenshots at three viewports and fix visual regressions.

### Prompt rules

- State the constraint: “No backend, no runtime AI, no network calls, no audio files.”
- Require a user gesture before creating or resuming the audio context.
- Require gain ramps on every start/stop.
- Require a mocked audio clock for scheduler tests.
- Cap polyphony and volume in code, not only in the UI.
- Provide screenshots when fixing layout or visualization issues.

### What not to delegate

- The volume-safety limits.
- The decision that the audio timing is correct.
- The accessibility of visuals-only mode.
- Classroom pilot feedback.
- Any claim that the app is safe for prolonged loud use.

### Definition of done

- All audio, timing, and interaction tests pass.
- The acceptance checklist is complete.
- A teacher can run the five challenges without developer help.
- The volume guard is enforced in code and visible in the UI.

---

## 13. Future extensions

- Full ADSR envelope editor.
- Multiple tracks and drum synthesis.
- MIDI export.
- Recording and playback.
- Scale and mode explorer.
- Chord progression builder.
- Classroom worksheet generator.
- Localization.

---

## 14. References

- MDN Web Audio API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- MDN AnalyserNode: https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode
- Web Audio API specification: https://www.w3.org/TR/webaudio/
- WCAG 2.2 quick reference: https://www.w3.org/WAI/WCAG22/quickref/
- Standard music-theory references for equal temperament and triads.

---

**Plan version:** 1.0
**Created:** 2026-10-27
**Next step:** scaffold the project, then implement M1 (frequency math + audio engine) before building the rooms.
