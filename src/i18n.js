/**
 * UI strings in English and Turkish. Placeholders such as {track} are filled
 * in by translate(). Every visible string of the app comes from here.
 */

/** Supported languages; the first one is the default. */
export const LANGUAGES = Object.freeze(['en', 'tr']);

const STRINGS = {
  en: {
    docTitle: 'Drum Machine',
    metaDescription:
      'A 16-step, 8-track drum machine in the browser: synthesized drums with velocity, swing, patterns A–D, a song chain and share links.',
    appTitle: 'Drum Machine',
    tagline: '16-step sequencer · 8 synthesized drums',
    newSong: 'New',
    newSongTitle: 'Start a new, empty song',
    langToggle: 'TR',
    langToggleLabel: 'TR – switch to Turkish',
    transportLabel: 'Transport',
    play: 'Play',
    stop: 'Stop',
    playTitle: 'Play or stop (Space)',
    tempo: 'Tempo',
    tempoLabel: 'Tempo in BPM',
    bpm: 'BPM',
    swing: 'Swing',
    swingLabel: 'Swing in percent',
    percent: '%',
    patterns: 'Pattern',
    patternsLabel: 'Patterns',
    patternButton: 'Pattern {id}',
    patternHeading: 'Pattern',
    pagerLabel: 'Visible steps',
    pageFirst: '1–8',
    pageSecond: '9–16',
    demoLabel: 'Load a demo groove into the selected pattern',
    demoPlaceholder: 'Demo grooves…',
    demo_rock: 'Rock',
    demo_house: 'House',
    demo_hiphop: 'Hip-hop',
    demo_bossa: 'Bossa-style',
    randomize: 'Randomize',
    randomizeTitle: 'Fill the selected pattern with a random groove',
    clear: 'Clear',
    clearTitle: 'Clear the selected pattern',
    share: 'Share link',
    shareTitle: 'Copy a link to this song',
    gridLabel: 'Step grid',
    track_kick: 'Kick',
    track_snare: 'Snare',
    track_chh: 'Closed hat',
    track_ohh: 'Open hat',
    track_clap: 'Clap',
    track_ltom: 'Low tom',
    track_htom: 'High tom',
    track_rim: 'Rim',
    previewLabel: '{track}: play sound (key {key})',
    mute: 'Mute',
    muteLabel: 'Mute {track}',
    solo: 'Solo',
    soloLabel: 'Solo {track}',
    volumeLabel: 'Volume of {track}',
    padLabel: '{track}, step {step}: {velocity}',
    velocity0: 'off',
    velocity1: 'soft',
    velocity2: 'normal',
    velocity3: 'accent',
    chainTitle: 'Song chain',
    chainOn: 'Chain on',
    chainOff: 'Chain off',
    chainToggleTitle: 'Play the chain bar by bar instead of the selected pattern',
    chainEmpty: 'Empty – add patterns with the + buttons',
    chainCount: '{count}/{max} bars',
    chainChip: 'Bar {bar}: pattern {id} (click to change, Delete to remove)',
    chainAdd: 'Add pattern {id} to the chain',
    chainBack: 'Remove the last bar',
    chainClear: 'Clear the chain',
    hints: 'Space: play/stop · 1–8: preview sounds · A–D: pick a pattern · Arrows + Enter: edit pads · Right-click: erase a pad',
    hintsTouch: 'Tap a pad: off → normal → accent → soft · Long-press a pad to erase it · Tap a track name to hear it',
    footer: 'MIT · Source on GitHub',
    linkCopied: 'Share link copied',
    linkInBar: 'The share link is in the address bar',
    linkLoaded: 'Song loaded from the link',
    linkBad: 'That link holds no valid song',
    cleared: 'Pattern {id} cleared',
    randomized: 'New groove in pattern {id}',
    demoLoaded: '{name} loaded into pattern {id}',
    newSongDone: 'New song started',
    chainCleared: 'Chain cleared',
    undo: 'Undo',
    noAudio: 'This browser cannot play audio',
  },
  tr: {
    docTitle: 'Davul Makinesi',
    metaDescription:
      'Tarayıcıda 16 adımlı, 8 kanallı davul makinesi: vuruş gücü ayarlı sentez davullar, swing, A–D desenleri, şarkı zinciri ve paylaşım bağlantıları.',
    appTitle: 'Davul Makinesi',
    tagline: '16 adımlı sekansör · 8 sentez davul',
    newSong: 'Yeni',
    newSongTitle: 'Yeni ve boş bir şarkı başlat',
    langToggle: 'EN',
    langToggleLabel: 'EN – İngilizceye geç',
    transportLabel: 'Çalma kontrolleri',
    play: 'Çal',
    stop: 'Durdur',
    playTitle: 'Çal veya durdur (Boşluk)',
    tempo: 'Tempo',
    tempoLabel: 'BPM cinsinden tempo',
    bpm: 'BPM',
    swing: 'Swing',
    swingLabel: 'Yüzde olarak swing',
    percent: '%',
    patterns: 'Desen',
    patternsLabel: 'Desenler',
    patternButton: '{id} deseni',
    patternHeading: 'Desen',
    pagerLabel: 'Görünen adımlar',
    pageFirst: '1–8',
    pageSecond: '9–16',
    demoLabel: 'Seçili desene demo ritim yükle',
    demoPlaceholder: 'Demo ritimler…',
    demo_rock: 'Rock',
    demo_house: 'House',
    demo_hiphop: 'Hip-hop',
    demo_bossa: 'Bossa tarzı',
    randomize: 'Rastgele',
    randomizeTitle: 'Seçili desene rastgele bir ritim yaz',
    clear: 'Temizle',
    clearTitle: 'Seçili deseni temizle',
    share: 'Paylaş',
    shareTitle: 'Bu şarkının bağlantısını kopyala',
    gridLabel: 'Adım ızgarası',
    track_kick: 'Bas davul',
    track_snare: 'Trampet',
    track_chh: 'Kapalı hat',
    track_ohh: 'Açık hat',
    track_clap: 'Alkış',
    track_ltom: 'Pes tom',
    track_htom: 'Tiz tom',
    track_rim: 'Kenar',
    previewLabel: '{track}: sesi çal (tuş {key})',
    mute: 'Sessiz',
    muteLabel: 'Sessiz – {track}',
    solo: 'Solo',
    soloLabel: 'Solo – {track}',
    volumeLabel: '{track}: ses düzeyi',
    padLabel: '{track}, {step}. adım: {velocity}',
    velocity0: 'kapalı',
    velocity1: 'hafif',
    velocity2: 'normal',
    velocity3: 'vurgulu',
    chainTitle: 'Şarkı zinciri',
    chainOn: 'Zincir açık',
    chainOff: 'Zincir kapalı',
    chainToggleTitle: 'Seçili desen yerine zinciri ölçü ölçü çal',
    chainEmpty: 'Boş – + düğmeleriyle desen ekle',
    chainCount: '{count}/{max} ölçü',
    chainChip: '{bar}. ölçü: {id} deseni (değiştirmek için tıkla, silmek için Delete)',
    chainAdd: '{id} desenini zincire ekle',
    chainBack: 'Son ölçüyü sil',
    chainClear: 'Zinciri temizle',
    hints: 'Boşluk: çal/durdur · 1–8: sesleri dinle · A–D: desen seç · Oklar + Enter: pedleri düzenle · Sağ tık: pedi sil',
    hintsTouch: 'Pede dokun: kapalı → normal → vurgulu → hafif · Silmek için pede uzun bas · Sesi duymak için kanal adına dokun',
    footer: 'MIT · Kaynak kodu GitHub’da',
    linkCopied: 'Paylaşım bağlantısı kopyalandı',
    linkInBar: 'Paylaşım bağlantısı adres çubuğunda',
    linkLoaded: 'Şarkı bağlantıdan yüklendi',
    linkBad: 'Bu bağlantıda geçerli bir şarkı yok',
    cleared: '{id} deseni temizlendi',
    randomized: '{id} desenine yeni bir ritim yazıldı',
    demoLoaded: '{name}, {id} desenine yüklendi',
    newSongDone: 'Yeni şarkı başladı',
    chainCleared: 'Zincir temizlendi',
    undo: 'Geri al',
    noAudio: 'Bu tarayıcı ses çalamıyor',
  },
};

/**
 * Returns a supported language code, falling back to English.
 * @param {unknown} value e.g. a stored choice
 * @returns {'en' | 'tr'}
 */
export function normalizeLanguage(value) {
  return LANGUAGES.includes(value) ? value : LANGUAGES[0];
}

/**
 * The language the toggle button switches to.
 * @param {string} language
 * @returns {'en' | 'tr'}
 */
export function otherLanguage(language) {
  return normalizeLanguage(language) === 'en' ? 'tr' : 'en';
}

/**
 * Lists the string keys of a language (used by the tests to compare languages).
 * @param {string} language
 * @returns {string[]}
 */
export function stringKeys(language) {
  return Object.keys(STRINGS[normalizeLanguage(language)]);
}

/**
 * Looks up a string and fills in its {placeholders}. Unknown keys fall back
 * to English, then to the key itself; unknown placeholders stay as written.
 * @param {string} language 'en' or 'tr'
 * @param {string} key
 * @param {Record<string, string | number>} [params]
 * @returns {string}
 */
export function translate(language, key, params = {}) {
  const text = STRINGS[normalizeLanguage(language)][key] ?? STRINGS.en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name) => (Object.hasOwn(params, name) ? String(params[name]) : match));
}
