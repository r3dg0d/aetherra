# AETHERRA Voice

AETHERRA Voice is a push-to-talk assistant mode. The assistant persona and its phrasing are **SIMULATED** (labelled in the panel); the data in its answers is real app data, and each result carries its data class (for example Launch Library 2 for the next launch, PREDICTED for tonight's computed sky).

## How it works

- Tap the microphone in the nav, or the mic in universal search. The panel opens as a dialog on desktop and a bottom sheet on mobile.
- Tap the big microphone to speak one command, or type a command. Typed commands always work and run the identical command engine.
- After every command the panel shows: transcript, parsed intent, parser confidence (plus speech-recognition confidence when spoken), the action taken, and the text reply. Voice is never the only feedback.
- Voice commands reuse the same destinations as universal search, so "Show me Jupiter" from voice, search and a typed command all open `/sky?body=Jupiter`.

## Privacy — read this

- **Push-to-talk only.** There is no wake word and no always-on listening. A `SpeechRecognition` object is only created after you tap the microphone, and it stops after one command.
- **AETHERRA receives no audio.** Nothing is uploaded to, or stored by, AETHERRA's servers. The typed command text also stays in your browser (except for the same API lookups typed search already makes, such as places or launches).
- **Your browser vendor may process audio.** The Web Speech API's recognition is implemented by the browser vendor (for example Google for Chrome) and, in most browsers, audio is sent to that vendor's speech service under their privacy policy. If that matters to you, use typed commands.
- Spoken replies (`speechSynthesis`) are generated on-device by your browser/OS voices.

## Browser support reality

| Capability | Chrome / Edge / Safari | Firefox |
|---|---|---|
| Speech recognition (`SpeechRecognition`/`webkitSpeechRecognition`) | Generally available (vendor service; needs network and mic permission) | **Not available** — the panel shows an UNSUPPORTED state and typed commands |
| Speech synthesis (`speechSynthesis`) | Available | Available |

Support is detected at runtime; nothing is assumed. In a browser without recognition, no permission prompt appears and the microphone button is disabled.

## Settings

Settings → AETHERRA Voice: voice replies on/off, voice rate (0.6–1.5) and pitch (0.5–1.6). Spoken replies are also suppressed by the global mute and by reduced-motion mode, and the panel states which reason applied. Reply text is always shown regardless.

## Command list

- **Navigate:** "go to sky / earth / orbit / flights / launches / ascent", "home", "status"
- **Find / fly to:** planets and the Moon ("Show me Jupiter"), constellations ("Find Orion"), ISS/Tiangong/Hubble ("Where is the ISS?"), stars and places by name via universal search ("find Betelgeuse", "find Tokyo" opens it on Earth)
- **Imagery:** "Mars rover photos", "Curiosity rover pictures", "Moon photos", "Jupiter Juno images", "Titan images"
- **Launches:** "When is the next launch?" (answered only from Launch Library 2 data with a real countdown; UNAVAILABLE rather than invented), "Remind me about the next launch" / "remind me about all launches" (shows a confirm button first; uses the existing reminder subscription flow, Web Push when configured, otherwise the in-app inbox)
- **Flights:** "Flights near London", "What's flying over Tokyo?" (centres the Flights map on the resolved place)
- **Tonight:** "What's visible tonight?" (computed ephemeris for your observer: conditions, bodies above the horizon, Moon phase)
- **Time:** "Pause time", "resume", "go live", "speed up time", "slow down"
- **Layers (Sky):** "Turn off constellation lines", "show labels", "hide grid", "show daylight stars"
- **Help:** "help" / "what can you do"

Unknown commands take no action and reply with guidance plus tappable examples.

## Implementation

- `src/lib/voice/intents.ts` — pure parser (utterance → intent), unit-tested with an utterance table.
- `src/lib/voice/speech.ts` — Web Speech wrapper; recognition is constructed only inside the tap handler.
- `src/components/voice/VoicePanel.tsx` — panel, executor (navigation/search/fetch actions against existing APIs and stores), reminder confirmation.
- E2E (`e2e/voice.spec.ts`) injects a fake `SpeechRecognition`, so no real microphone or vendor service is involved.
