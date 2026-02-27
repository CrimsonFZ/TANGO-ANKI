export type SpeakJaOptions = {
  rate?: number;
  pitch?: number;
};

let cachedJaVoice: SpeechSynthesisVoice | null = null;

function pickJaVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  if (cachedJaVoice) return cachedJaVoice;

  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const jaVoice =
    voices.find((voice) => voice.lang.toLowerCase().startsWith("ja")) ??
    voices.find((voice) => /japanese|nihongo|ja/i.test(voice.name)) ??
    null;

  cachedJaVoice = jaVoice;
  return jaVoice;
}

export function speakJa(text: string, options: SpeakJaOptions = {}): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  if (!text.trim()) return;

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "ja-JP";
  utter.rate = options.rate ?? 0.95;
  utter.pitch = options.pitch ?? 1;

  const voice = pickJaVoice();
  if (voice) {
    utter.voice = voice;
  }

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedJaVoice = null;
  };
}
