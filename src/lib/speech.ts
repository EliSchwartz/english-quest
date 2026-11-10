let voice: SpeechSynthesisVoice | null = null;

function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en'));
  voice =
    voices.find((v) => v.lang === 'en-US' && /google/i.test(v.name)) ??
    voices.find((v) => v.lang === 'en-US') ??
    voices.find((v) => v.lang === 'en-GB') ??
    voices[0] ??
    null;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
}

export function speak(text: string, slow = false) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = voice?.lang ?? 'en-US';
  if (voice) u.voice = voice;
  u.rate = slow ? 0.6 : 0.85;
  speechSynthesis.speak(u);
}
