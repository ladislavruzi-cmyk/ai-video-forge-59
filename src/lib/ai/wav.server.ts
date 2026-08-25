/**
 * Čtení skutečné délky audio souboru z jeho hlavičky.
 * Pracuje s WAV (RIFF) soubory, které vytváří náš TTS krok.
 */

export interface AudioInfo {
  seconds: number;
  sampleRate: number;
  channels: number;
  bytes: number;
}

/** Vrátí skutečnou délku WAV souboru vypočtenou z hlavičky a velikosti dat. */
export function readWavInfo(buffer: ArrayBuffer): AudioInfo {
  const view = new DataView(buffer);
  if (buffer.byteLength < 44) throw new Error("Audio soubor je příliš krátký nebo poškozený.");

  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
  if (riff !== "RIFF" || wave !== "WAVE") {
    throw new Error("Audio soubor není ve formátu WAV — délku nelze spolehlivě zjistit.");
  }

  let offset = 12;
  let sampleRate = 0;
  let channels = 0;
  let bitsPerSample = 0;
  let byteRate = 0;
  let dataBytes = 0;

  while (offset + 8 <= buffer.byteLength) {
    const id = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3),
    );
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;

    if (id === "fmt ") {
      channels = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
      byteRate = view.getUint32(body + 8, true);
      bitsPerSample = view.getUint16(body + 14, true);
    } else if (id === "data") {
      // Některé streamované WAVy mají v hlavičce nulovou/neplatnou velikost.
      dataBytes = size > 0 && body + size <= buffer.byteLength ? size : buffer.byteLength - body;
      break;
    }

    offset = body + size + (size % 2);
  }

  const effectiveByteRate =
    byteRate > 0 ? byteRate : (sampleRate * channels * bitsPerSample) / 8;

  if (!effectiveByteRate || !dataBytes) {
    throw new Error("V audio souboru se nepodařilo najít zvukovou stopu.");
  }

  return {
    seconds: Math.round((dataBytes / effectiveByteRate) * 100) / 100,
    sampleRate,
    channels,
    bytes: buffer.byteLength,
  };
}
