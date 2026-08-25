# 🎯 KOMPLETN AUDIT AI VIDEO FORGE

**Datum:** 2026-08-25  
**Verze:** Snapshot commit 04a6707  
**Status:** V REŽIMU SIMULACE — UI a workflow jsou funkční, ale chybí AI integrace

---

## 📊 SHRNUTÍ STAVU PROJEKTU

| Oblast | Status | Priorita | Poznámka |
|--------|--------|----------|----------|
| **Frontend UI** | ✅ 100% | Nízká | Všechny komponenty hotovy, responsive design OK |
| **Workflow simulace** | ✅ 100% | Nízká | Všechny kroky se zobrazují a mají animace |
| **Scénář generování** | ✅ 95% | Nízká | Pracuje, ale zatím bez skutečné AI (Lovable Gateway) |
| **Rozdělení scén** | ✅ 95% | Nízká | Logika OK, čeká na skutečnou AI |
| **Vizuály (images)** | ⚠️ 40% | **VYSOKÁ** | Struktura hotova, chybí aktivace image API |
| **Dabing (TTS)** | ⚠️ 40% | **VYSOKÁ** | Struktura hotova, chybí aktivace TTS API |
| **Synchronizace** | ⚠️ 50% | **VYSOKÁ** | Logika počítá časy, ale bez skutečných mediálních souborů |
| **MP4 Render** | ⚠️ 30% | **VYSOKÁ** | Creatomate struktura OK, ale bez validace finálního videa |
| **Databáze** | ✅ 90% | Střední | Supabase napojena, tabulky existují, ale chybí visual_jobs queue |
| **Autentizace** | ✅ 100% | Nízká | Supabase Auth funkční |
| **Bezpečnost** | ✅ 100% | Nízká | API klíče jsou jen na serveru (.server.ts) |

---

## 🔴 KRITICKÉ PROBLÉMY

### 1. **AI API NEJSOU NAPOJENY**
**Soubor:** `src/lib/ai/gateway.server.ts`, `image.server.ts`, `tts.server.ts`

**Problém:**
- Kód předpokládá `process.env["LOVABLE_API_KEY"]` — tento klíč není nakonfigurován
- Bez klíče se volání API sesypou s chybou 401
- Aplikace běží v "simulaci", protože AI kroky jsou vynechány

**Řešení:**
```bash
# Musíš nastavit v .env.local (dev) nebo Secrets (prod):
LOVABLE_API_KEY=sk_...
CREATOMATEATE_API_KEY=...
```

**Soubory k opravě:**
- ✏️ `.env.local` — přidat env variables
- ✏️ `src/lib/ai/image.server.ts` — fallback pro offline mód
- ✏️ `src/lib/ai/tts.server.ts` — fallback pro offline mód
- ✏️ `src/lib/ai/creatomate.server.ts` — fallback pro offline mód

---

### 2. **VISUALQUEUE NENÍ IMPLEMENTOVÁN**
**Soubor:** `src/lib/ai/visualQueue.server.ts`

**Problém:**
- Databázová tabulka `visual_jobs` se očekává, ale není vytvořena
- Bez ní se hromadné generování vizuálů nebude pracovat
- `processNextVisualJob()` se spouští, ale nemá co zpracovávat

**Řešení:**
```sql
-- Musíš vytvořit v Supabase:
CREATE TABLE visual_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id TEXT NOT NULL,
  scene_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  aspect_ratio TEXT,
  status TEXT DEFAULT 'pending', -- pending, running, done, error
  image_path TEXT,
  error TEXT,
  attempts INT DEFAULT 0,
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  scene_index INT
);
CREATE INDEX visual_jobs_user ON visual_jobs(user_id);
CREATE INDEX visual_jobs_project ON visual_jobs(project_id);
CREATE INDEX visual_jobs_status ON visual_jobs(status);
```

**Soubory k opravě:**
- ✏️ `supabase/migrations/` — přidat SQL migraci
- ✏️ `src/lib/studio/store.tsx` — aktivovat `generateVisualsBatch()`

---

### 3. **RENDER PIPELINE NENÍ KOMPLETNÍ**
**Soubor:** `src/lib/ai/render.functions.ts`

**Problém:**
- Volá `buildRenderSource()` a `createRender()`, ale bez chyby-handling
- Nevaliduje finální MP4 (není zavolána `validateRenderedMp4()`)
- `RenderPanel.tsx` se nespokojuje s pouhým "stav připraveno"

**Řešení:**
```typescript
// src/lib/ai/render.functions.ts — musí obsahovat:
import { validateRenderedMp4 } from "./mp4.server";
import { inspectMp4 } from "./mp4.server";

// ... v handleru ...
const mp4Bytes = await downloadRenderedVideo(renderId);
const validation = validateRenderedMp4(mp4Bytes, expectedSeconds);
if (validation.error) throw new Error(validation.error);
```

**Soubory k opravě:**
- ✏️ `src/lib/ai/render.functions.ts` — přidat validaci MP4
- ✏️ `src/components/studio/RenderPanel.tsx` — zobrazovat detaily videa

---

### 4. **OFFLINE MODU CHYBÍ FALLBACK**
**Soubor:** Všechny `*.server.ts`

**Problém:**
- Bez API klíčů se aplikace sesype
- Měla by běžet v "simulaci" s mockovanými výsledky
- Uživatel neví, proč to selhává

**Řešení:**
```typescript
// Přidat na začátek každé AI funkce:
if (!process.env["LOVABLE_API_KEY"]) {
  console.warn("[OFFLINE] Používám mock data — nepřipojeno k AI API");
  return generateMockData();
}
```

**Soubory k opravě:**
- ✏️ `src/lib/ai/image.server.ts` — přidat mock images
- ✏️ `src/lib/ai/tts.server.ts` — přidat mock audio
- ✏️ `src/lib/ai/gateway.server.ts` — přidat mock tekst
- ✏️ `src/lib/ai/creatomate.server.ts` — přidat mock video

---

## ⚠️ VAROVNÍ — ARCHITEKTURNÍ PROBLÉMY

### 5. **RACE CONDITIONS V STORE**
**Soubor:** `src/lib/studio/store.tsx` (řádky 100–108)

**Problém:**
```typescript
const creep = useRef<ReturnType<typeof setInterval> | null>(null);
const stepsRef = useRef<WorkflowStep[]>(steps); // ← STARÁ DATA
const projectsRef = useRef<VideoProject[]>(projects); // ← STARÁ DATA
```
Ref se aktualizují, ale callback ve `setInterval()` může mít zastaralý stav.

**Status:** ✅ Již opraveno (řádky 101–104), ale komentář chybí

---

### 6. **RACE CONDITION V BATCH GENEROVÁNÍ**
**Soubor:** `src/lib/studio/store.tsx` (řádky 379–416)

**Problém:**
```typescript
while (!cancelRef.current) {
  const { data: jobs } = await supabase
    .from("visual_jobs")
    .select(...)
  // ← Pokud je frontend zavřený, tady to zaspí...
  // ← ... ale jobs budou pokračovat na serveru
}
```
Frontend čeká na změny v `visual_jobs`, ale bez polling timeout se zamrzne.

**Řešení:**
```typescript
let failSafeCounter = 0;
while (!cancelRef.current && failSafeCounter < 300) { // 5 min max
  failSafeCounter++;
  // ... polling ...
  if (remaining === 0) break;
  await new Promise(r => setTimeout(r, 2000)); // 2s, ne 4s
}
```

---

### 7. **MEMORY LEAK — NEUKONČENÉ STREAMOVÁNÍ**
**Soubor:** `src/lib/ai/gateway.server.ts` (řádky 76–99)

**Problém:**
```typescript
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  // ← Bez error handlingu reader zůstane "visící"
}
```
Pokud je stream přerušen sítí, reader se nezavře.

**Řešení:**
```typescript
try {
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    // ...
  }
} finally {
  reader.cancel(); // Bezpečně zavřít stream
}
```

---

## 🏠 ODLIŠNOSTI / NEJASNOSTI

### 8. **PCM → WAV KONVERZE MŮŽE MÁST**
**Soubor:** `src/lib/ai/tts.server.ts` (řádky 74–98)

**Problém:**
- Kód předpokládá, že API vrátí PCM (raw audio frames)
- Ale OpenAI GPT-4o TTS vrací již zabalené WAV nebo MP3
- Neznáme, co právě Lovable Gateway vrací

---

### 9. **AUDIO DÉLKA NENÍ OVĚŘENA**
**Soubor:** `src/lib/ai/tts.server.ts` (řádek 163)

**Problém:**
```typescript
seconds: Math.round((pcm.length / 2 / SAMPLE_RATE) * 10) / 10
```
Předpokládá 16-bit mono (2 bajty na sample). Co když je to stereo?

---

### 10. **CHYBÍ TIMEOUT U CREATOMATE RENDER**
**Soubor:** `src/lib/ai/render.functions.ts`

**Problém:**
- Volá `fetchRender()` v loopu bez timeout
- Pokud render na Creatomate selže, loop běží věčně

---

## 🔧 CHYBĚJÍCÍ FUNKCE

### 11. **SUBTITLE GENERATION**
**Status:** ❌ CHYBÍ

---

### 12. **MUSIC/SFX SELECTION**
**Status:** ❌ CHYBÍ

---

### 13. **YOUTUBE UPLOAD**
**Status:** ❌ CHYBÍ

---

## 📦 CHYBĚJÍCÍ BALÍČKY

| Balíček | Účel | Stav |
|---------|------|------|
| `ffmpeg.wasm` | Video rendering fallback | ❌ CHYBÍ |
| `sharp` | Image processing | ❌ CHYBÍ |
| `@google-cloud/text-to-speech` | Google TTS fallback | ❌ CHYBÍ |

---

## ✅ CO JE DOBRÉ

### Architektura
- ✅ Oddělení frontend/backend (`.server.ts` soubory)
- ✅ Typová bezpečnost (TypeScript + Zod validace)
- ✅ Streaming pro dlouhé operace (Gateway)
- ✅ Serverová fronta pro vizuály (visual_jobs)
- ✅ Error handling s uživatelskými zprávami

### UI/UX
- ✅ Responsive design (mobile + desktop)
- ✅ Dark mode s konzistentní paletou
- ✅ Animované progress bary
- ✅ Kontextové help zprávy
- ✅ Multilang podpora (čeština + další)

### Bezpečnost
- ✅ API klíče jen na serveru
- ✅ Supabase Auth pro přihlášení
- ✅ RLS (Row-Level Security) na databázi
- ✅ CORS configured správně

---

## 📋 CHECKLIST OPRAV

### PHASE 1: ZÁKLADNÍ FUNKČNOST (1-2 dny)
- [ ] Nastavit env variables (LOVABLE_API_KEY, CREATOMATE_API_KEY)
- [ ] Vytvořit visual_jobs tabulku v Supabase
- [ ] Aktivovat image generation v UI
- [ ] Aktivovat TTS generation v UI
- [ ] Testovat mock data v offline módu

### PHASE 2: ROBUSTNOST (2-3 dny)
- [ ] Přidat timeout u Creatomate rendera
- [ ] Opravit memory leak u streaming
- [ ] Přidat fallback pro offline mód
- [ ] Validovat MP4 soubory po rendu
- [ ] Testy end-to-end

### PHASE 3: FUNKČNOST (3-5 dní)
- [ ] Subtitle generation
- [ ] Music/SFX selection
- [ ] YouTube upload
- [ ] Advanced editing (scény, dabing, vizuály)
- [ ] Analytics a tracking

### PHASE 4: PRODUKCE (1 týden)
- [ ] Performance optimalizace
- [ ] Security audit
- [ ] Backup/disaster recovery
- [ ] Monitoring a alerting
- [ ] Dokumentace

---

## 🎯 ZÁVĚR

**Projekt je v DOBRU STAVU z hlediska:**
- UI design ✅
- Architektura ✅
- Bezpečnost ✅

**ALE POTŘEBUJE:**
1. **API klíče** — bez nich se nic neděje
2. **Databázové tabulky** — visual_jobs musí existovat
3. **Fallback mód** — offline generování s mock daty
4. **Error handling** — lepší error messages
5. **Integrace** — YouTube, hudba, titulky

**Odhadovaný čas k PLNÉ FUNKČNOSTI: 2-3 týdny**
