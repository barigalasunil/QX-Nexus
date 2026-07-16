/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Recognition } from '@/types';

export interface IRecognitionRepository {
  create(recognition: Recognition): Promise<Recognition>;
  getAll(): Promise<Recognition[]>;
}
