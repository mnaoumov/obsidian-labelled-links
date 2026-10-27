import {
  describe,
  expect,
  it
} from 'vitest';

import {
  PLUGIN_API_CONTRACT,
  PLUGIN_API_VERSION,
  RELATIONS_CHANGED_EVENT_NAME
} from './labelled-links-api.ts';

/*
 * These values are a WIRE CONTRACT: a consumer hardcodes the event name rather than importing it, and
 * negotiates against the version. So the test asserts the literals themselves — a rename that compiles
 * everywhere in this repo still breaks every plugin already listening, and this is the only thing that
 * notices.
 */
describe('the published contract', () => {
  it('should keep the event name it published', () => {
    expect(RELATIONS_CHANGED_EVENT_NAME).toBe('labelled-links:relations-changed');
  });

  it('should declare every member of the api in the contract', () => {
    expect(Object.keys(PLUGIN_API_CONTRACT).sort()).toEqual(['getDerivedRelations', 'getInverseLabel', 'getRelations']);
  });

  it('should publish a contract version independent of the plugin version', () => {
    expect(PLUGIN_API_VERSION).toBe('1.2.0');
  });
});
