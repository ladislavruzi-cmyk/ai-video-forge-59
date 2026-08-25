# AI Video Forge

Vytvoř moderní webovou aplikaci s názvem „AI YouTube Studio“.



Cílem aplikace je umožnit uživateli vytvořit kompletní YouTube video pouze zadáním tématu.



Vytvoř profesionální, moderní a přehledné rozhraní v češtině.



HLAVNÍ OBRAZOVKA:



V horní části zobraz název:

„AI YouTube Studio“



Pod něj text:

„Vytvoř kompletní YouTube video pomocí AI“



Vytvoř formulář s těmito poli:



1. Téma videa



- velké textové pole

- placeholder: „Například: Tajemství Bermudského trojúhelníku“



2. Délka videa



- výběr:

  - 1–3 minuty

  - 5 minut

  - 10 minut

  - 20 minut

  - 40 minut

  - vlastní délka



3. Jazyk videa



- Čeština

- Slovenština

- Angličtina

- Němčina

- Polština



4. Styl videa



- Dokumentární

- Filmový

- Tajemný

- Historický

- Vědecký

- Hororový

- Vzdělávací

- Motivující



5. Typ hlasu



- Mužský – hluboký

- Mužský – přirozený

- Ženský – přirozený

- Ženský – dramatický



6. Poměr stran



- YouTube 16:9

- YouTube Shorts 9:16



7. Hudba



- Bez hudby

- Atmosférická

- Filmová

- Napínavá

- Tajemná

- Motivující



Pod formulář umísti velké tlačítko:



„VYTVOŘIT VIDEO“



Po kliknutí NEGENERUJ zatím skutečné video. Vytvoř pouze workflow simulace, které bude později napojeno na AI API.



Workflow zobraz jako jednotlivé kroky:



1. Analýza tématu

2. Vytvoření scénáře

3. Rozdělení scén

4. Vytvoření vizuálů

5. Generování dabingu

6. Synchronizace obrazu a zvuku

7. Přidání hudby a efektů

8. Vytvoření titulků

9. Renderování videa

10. Export pro YouTube



Každý krok zobraz jako kartu s ikonou, stavem a indikátorem průběhu.



Použij stavy:



- Čeká

- Probíhá

- Dokončeno

- Chyba



Po dokončení workflow zobraz stránku „Projekt videa“.



Na této stránce zobraz:



- Název videa

- Náhled videa

- Celkovou délku

- Počet scén

- Použitý hlas

- Použitou hudbu

- Stav projektu



Přidej sekce:



SCÉNÁŘ



- kompletní text scénáře

- možnost upravit jednotlivé scény



SCÉNY



- seznam scén

- každá scéna obsahuje:

  - číslo scény

  - název

  - text dabingu

  - popis obrazu

  - délku

  - stav



DABING



- vybraný hlas

- možnost přehrát ukázku hlasu



VIZUÁLY



- náhled jednotlivých scén

- možnost regenerovat konkrétní scénu



HUDBA A EFEKTY



- seznam použitých zvuků a hudby



TITULKY



- náhled titulků

- možnost zapnout/vypnout titulky



EXPORT



- tlačítko „Exportovat video“

- tlačítko „Stáhnout video“

- tlačítko „Připravit pro YouTube“



Vytvoř také levé boční menu:



Dashboard

Nové video

Moje projekty

Šablony

Hlasy

Hudba

Nastavení



DESIGN:



Použij moderní profesionální dark mode rozhraní vhodné pro AI video studio.



Použij:



- tmavé pozadí

- čisté karty

- výrazná tlačítka

- moderní ikony

- přehledné progress bary

- responzivní design pro mobil i počítač



ARCHITEKTURA:



Aplikaci připrav tak, aby bylo možné později připojit externí API pro:



- generování scénáře

- AI obrázky

- AI video

- text-to-speech

- generování hudby

- titulky

- video rendering

- YouTube API



Nevytvářej falešné API klíče a nevkládej žádné skutečné tajné klíče přímo do frontendového kódu.



Připrav strukturu aplikace tak, aby API klíče byly později uloženy bezpečně na serverové straně.



Nejdříve vytvoř kompletní funkční UI a simulaci workflow. Každý krok musí být vizuálně funkční a aplikace musí být použitelná i bez připojených AI API.



Po dokončení mi zobraz hotovou aplikaci v preview.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/882a71f3-e4f5-444d-bd54-08a8de741175).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
