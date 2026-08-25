/**
 * Minimální čtečka MP4 kontejneru — ověřuje, že vyrenderovaný soubor je
 * skutečné přehratelné video, ne prázdný nebo poškozený výstup.
 * Běží jen na serveru, bez nativních závislostí.
 */

export interface Mp4Facts {
  /** Platný MP4 kontejner (ftyp + moov). */
  container: boolean;
  hasVideo: boolean;
  hasAudio: boolean;
  width: number | null;
  height: number | null;
  /** Délka podle mvhd (s). */
  seconds: number | null;
  /** Rychlá indikace faststart (moov před mdat) pro streamování v prohlížeči. */
  fastStart: boolean;
  /** Kód formátu obrazové stopy (avc1 = H.264, hvc1 = H.265). */
  videoCodec: string | null;
  /** Kód formátu zvukové stopy (mp4a = AAC). */
  audioCodec: string | null;
  /** Velikost souboru v bajtech. */
  bytes: number;
}


function u32(b: Uint8Array, o: number): number {
  return ((b[o]! << 24) | (b[o + 1]! << 16) | (b[o + 2]! << 8) | b[o + 3]!) >>> 0;
}

function type(b: Uint8Array, o: number): string {
  return String.fromCharCode(b[o]!, b[o + 1]!, b[o + 2]!, b[o + 3]!);
}

/** Projde boxy v daném rozsahu a zavolá callback pro každý. */
function walk(
  b: Uint8Array,
  start: number,
  end: number,
  visit: (name: string, from: number, to: number) => void,
): void {
  let o = start;
  while (o + 8 <= end) {
    let size = u32(b, o);
    const name = type(b, o + 4);
    let headerSize = 8;
    if (size === 1) {
      // 64bit velikost — horní 32 bitů ignorujeme, soubory jsou < 4 GB.
      size = u32(b, o + 12);
      headerSize = 16;
    }
    if (size === 0) size = end - o;
    if (size < headerSize) return;
    visit(name, o + headerSize, Math.min(o + size, end));
    o += size;
  }
}

export function inspectMp4(bytes: Uint8Array): Mp4Facts {
  const facts: Mp4Facts = {
    container: false,
    hasVideo: false,
    hasAudio: false,
    width: null,
    height: null,
    seconds: null,
    fastStart: false,
    videoCodec: null,
    audioCodec: null,
    bytes: bytes.byteLength,
  };

  if (bytes.byteLength < 32) return facts;

  let moovAt = -1;
  let mdatAt = -1;
  let hasFtyp = false;

  walk(bytes, 0, bytes.byteLength, (name, from) => {
    if (name === "ftyp") hasFtyp = true;
    if (name === "moov" && moovAt < 0) moovAt = from;
    if (name === "mdat" && mdatAt < 0) mdatAt = from;
  });

  if (!hasFtyp || moovAt < 0) return facts;
  facts.container = true;
  facts.fastStart = mdatAt < 0 || moovAt < mdatAt;

  // moov končí tam, kde začíná další box; pro jednoduchost projdeme až do konce.
  walk(bytes, moovAt, bytes.byteLength, (name, from, to) => {
    if (name === "mvhd") {
      const version = bytes[from]!;
      if (version === 0) {
        const timescale = u32(bytes, from + 12);
        const duration = u32(bytes, from + 16);
        if (timescale > 0) facts.seconds = Math.round((duration / timescale) * 100) / 100;
      } else {
        const timescale = u32(bytes, from + 20);
        const duration = u32(bytes, from + 28);
        if (timescale > 0) facts.seconds = Math.round((duration / timescale) * 100) / 100;
      }
    }
    if (name === "trak") {
      let kind: "vide" | "soun" | null = null;
      let format: string | null = null;
      let w = 0;
      let h = 0;
      walk(bytes, from, to, (n2, f2, t2) => {
        if (n2 === "tkhd") {
          const version = bytes[f2]!;
          const base = version === 1 ? f2 + 88 : f2 + 76;
          w = u32(bytes, base) / 65536;
          h = u32(bytes, base + 4) / 65536;
        }
        if (n2 === "mdia") {
          walk(bytes, f2, t2, (n3, f3, t3) => {
            if (n3 === "hdlr") {
              const handler = type(bytes, f3 + 8);
              if (handler === "vide") kind = "vide";
              if (handler === "soun") kind = "soun";
            }
            if (n3 === "minf") {
              walk(bytes, f3, t3, (n4, f4, t4) => {
                if (n4 !== "stbl") return;
                walk(bytes, f4, t4, (n5, f5) => {
                  // stsd: 4 B verze/flags + 4 B počet položek, pak sample entry (4 B size + 4 B formát)
                  if (n5 === "stsd" && !format) format = type(bytes, f5 + 12);
                });
              });
            }
          });
        }
      });
      if (kind === "vide") {
        facts.hasVideo = true;
        if (format) facts.videoCodec = format;
        if (w > 1 && h > 1) {
          facts.width = Math.round(w);
          facts.height = Math.round(h);
        }
      }
      if (kind === "soun") {
        facts.hasAudio = true;
        if (format) facts.audioCodec = format;
      }
    }
  });

    }
  });

  return facts;
}

/**
 * Validace před stavem „Video připraveno“. Vrací českou chybu, nebo null.
 */
export function validateRenderedMp4(
  bytes: Uint8Array,
  expectedSeconds: number | null,
): { error: string | null; facts: Mp4Facts } {
  const facts = inspectMp4(bytes);
  if (bytes.byteLength === 0) {
    return { error: "Vyrenderovaný soubor je prázdný (0 bajtů).", facts };
  }
  if (!facts.container) {
    return { error: "Vyrenderovaný soubor není platný MP4 kontejner.", facts };
  }
  if (!facts.hasVideo) {
    return { error: "Vyrenderovaný soubor neobsahuje obrazovou stopu.", facts };
  }
  if (!facts.hasAudio) {
    return { error: "Vyrenderovaný soubor neobsahuje zvukovou stopu (dabing).", facts };
  }
  if (!facts.seconds || facts.seconds < 1) {
    return { error: "Z vyrenderovaného souboru nelze přečíst délku videa.", facts };
  }
  if (expectedSeconds && expectedSeconds > 0) {
    const diff = Math.abs(facts.seconds - expectedSeconds) / expectedSeconds;
    if (diff > 0.1) {
      return {
        error: `Délka videa (${facts.seconds.toFixed(1)} s) neodpovídá časové ose (${expectedSeconds.toFixed(1)} s).`,
        facts,
      };
    }
  }
  return { error: null, facts };
}
