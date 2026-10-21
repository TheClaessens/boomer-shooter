// Level registry. Campaign order follows each level's `next`; 'overtime' is the endless mode.
import tower from './tower.js';
import archives from './archives.js';
import rooftop from './rooftop.js';
import overtime from './overtime.js';
import bart from './bart.js';

export const LEVELS = { tower, archives, rooftop, overtime, bart };
export const CAMPAIGN = ['tower', 'archives', 'rooftop'];
