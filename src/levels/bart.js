import * as THREE from 'three';
import rooftop from './rooftop.js';

// Straight to the final boss: the rooftop, starting on the helipad's south edge just short of the meeting trigger.
export default {
  ...rooftop,
  id: 'bart',
  name: 'FINAL BOSS: BART',
  build(B) {
    const r = rooftop.build(B);
    r.spawn = { pos: new THREE.Vector3(0, 0, -2.5), yaw: 0 };
    return r;
  },
};
