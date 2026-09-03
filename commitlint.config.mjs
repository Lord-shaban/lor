/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],

  // Dependabot writes "chore(deps): Bump foo from 1 to 2" and offers no way to
  // lowercase that verb, so its commits would fail subject-case forever. Exempt
  // the bot rather than relaxing the rule for people.
  ignores: [(message) => /^Signed-off-by: dependabot\[bot\]/m.test(message)],

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
