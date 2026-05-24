import { wrapEffect } from '@react-three/postprocessing';
import { LensDistortionEffect } from 'postprocessing';

/** Barrel / fisheye distortion via postprocessing LensDistortionEffect */
export const LensDistortion = wrapEffect(LensDistortionEffect);
