/**
 * @file
 *
 * The runtime half of this plugin's published contract: the event name, the registry contract and its
 * version.
 *
 * The TYPES are not declared here. They live in the repo-root `api.d.ts`, which is the file a consumer
 * reads, and are imported from it so there is exactly one declaration of each and nothing to drift.
 */

import type { ApiContract } from '@mnaoumov/typescript-lib/api-contract';

import type { RelationsChangedEventName } from '../../api.d.ts';

import { LABELLED_LINKS_API_CONTRACT } from '../../api-contract.ts';

export type {
  LabelledLinksApi,
  LabelledLinksDerivedRelation,
  LabelledLinksGetDerivedRelationsOptions,
  LabelledLinksGetRelationsOptions,
  LabelledLinksRelation,
  LabelledLinksRelationDirection,
  RelationsChangedEventName,
  RelationsChangedEventPayload
} from '../../api.d.ts';

/**
 * Triggered on `app.workspace` when notes' relations may have changed.
 */
export const RELATIONS_CHANGED_EVENT_NAME: RelationsChangedEventName = 'labelled-links:relations-changed';

/**
 * The contract this plugin publishes: the repo-root `api-contract.ts` constant a consumer copies, so the
 * provider and its consumers validate against one definition. Assigning it here is also what checks that
 * its schemas are Standard Schemas the registry accepts.
 */
export const PLUGIN_API_CONTRACT: ApiContract = LABELLED_LINKS_API_CONTRACT;

/**
 * The version of the contract above — independent of the plugin's own version, so a consumer asks for
 * `'^1'` and keeps working across releases that change nothing it depends on.
 */
export const PLUGIN_API_VERSION = '1.2.0';
