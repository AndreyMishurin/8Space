const appVersion = import.meta.env.VITE_APP_VERSION ?? '0.0.0';
const buildShaRaw = import.meta.env.VITE_BUILD_SHA ?? 'local';
const buildDateRaw = import.meta.env.VITE_BUILD_DATE ?? '';

const buildSha = buildShaRaw === 'local' ? 'local' : buildShaRaw.slice(0, 7);
const buildDate = buildDateRaw.includes('T') ? buildDateRaw.split('T')[0] : buildDateRaw;

const label = buildSha === 'local' ? `v${appVersion} (local)` : `v${appVersion} (${buildSha})`;
const details = buildDate ? `${label} • ${buildDate}` : label;

export const buildInfo = {
  version: appVersion,
  sha: buildSha,
  date: buildDate,
  label,
  details,
};
