// The megha theme. `astryx experimental theme editor` wrote this file once and never changes it again.
// The checked settings live in megha.settings.json and the generated megha.settings.ts;
// change them with `astryx experimental theme editor set megha ...`. Add your own changes below: they win over the settings.
import {defineTheme} from '@astryxdesign/core/theme';
import {meghaSettings} from './megha.settings';

export const meghaTheme = defineTheme({
  extends: meghaSettings,
  name: 'megha',
});
