/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'call',      // media, grid, screen share
        'stt',       // captions, VAD, transcription engines
        'ai',        // summaries, decisions, action items
        'board',     // whiteboard, notes, Yjs
        'room',      // room lifecycle, codes, host controls
        'keys',      // API keys, quotas, BYOK
        'ui',        // shared components, theming, RTL
        'i18n',
        'db',
        'infra',     // CI, docker, deploy
        'deps',
        'readme',
        'eval',
      ],
    ],
    'body-max-line-length': [0, 'always'],
  },
};
