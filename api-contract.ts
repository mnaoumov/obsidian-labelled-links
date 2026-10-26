/**
 * @file
 *
 * The runtime half of `Labelled Links`' published API: its CONTRACT, one entry per method of
 * {@link LabelledLinksApi}, each with a schema over the argument list and a schema over the value the method
 * returns.
 *
 * This plugin publishes exactly this constant with its API, and a consumer copies it beside `api.d.ts` and
 * passes it as the `contract` when it looks the API up, so both ends validate against ONE definition. The
 * plugin registry checks the payloads against it only while the `obsidian-lib:validate-plugin-api-payloads`
 * debug switch is on.
 *
 * Copying it takes one dependency beside `api.d.ts`: `@mnaoumov/typescript-lib`, whose `api-contract` entry
 * point carries the contract type, the {@link https://standardschema.dev | Standard Schema} builders and the
 * common guards. {@link defineApiContract} checks every entry against its method's signature.
 *
 * It is not named `api.ts`: TypeScript would read `api.d.ts` as that file's own declarations.
 */

import type { Reference } from 'obsidian';

import {
  arrayGuard,
  BOOLEAN_GUARD,
  createApiContractSchemaBuilders,
  defineApiContract,
  instanceOfGuard,
  literalGuard,
  nullableGuard,
  objectGuard,
  optionalGuard,
  optionsGuard,
  STRING_GUARD,
  unionGuard
} from '@mnaoumov/typescript-lib/api-contract';
import { TFile } from 'obsidian';

import type {
  LabelledLinksApi,
  LabelledLinksDerivedRelation,
  LabelledLinksGetDerivedRelationsOptions,
  LabelledLinksGetRelationsOptions,
  LabelledLinksRelation,
  LabelledLinksRelationDirection
} from './api.d.ts';

const { createArgumentsSchema, createTypeGuardSchema } = createApiContractSchemaBuilders('labelled-links');

const LABEL_GUARD = { ...STRING_GUARD, expected: 'a relation label' };
const NULLABLE_LABEL_GUARD = nullableGuard(LABEL_GUARD);
const PATH_GUARD = { ...STRING_GUARD, expected: 'a note path' };
const DIRECTION_GUARD = literalGuard<LabelledLinksRelationDirection>({ incoming: true, outgoing: true });

const REFERENCE_GUARD = objectGuard<Reference>({
  displayText: optionalGuard(STRING_GUARD),
  link: STRING_GUARD,
  original: STRING_GUARD
}, { description: 'a cached reference' });

const RELATION_GUARD = objectGuard<LabelledLinksRelation>({
  direction: DIRECTION_GUARD,
  isTargetResolved: BOOLEAN_GUARD,
  label: NULLABLE_LABEL_GUARD,
  linkLabel: NULLABLE_LABEL_GUARD,
  reference: REFERENCE_GUARD,
  sourcePath: PATH_GUARD,
  targetPath: PATH_GUARD
}, { description: 'a relation' });

const GET_RELATIONS_OPTIONS_GUARD = optionsGuard<LabelledLinksGetRelationsOptions>({
  direction: DIRECTION_GUARD,
  includeSubLabels: BOOLEAN_GUARD,
  label: NULLABLE_LABEL_GUARD
}, { description: 'relation filters' });

const DERIVED_RELATION_GUARD = objectGuard<LabelledLinksDerivedRelation>({
  isTargetResolved: BOOLEAN_GUARD,
  label: LABEL_GUARD,
  sourcePath: PATH_GUARD,
  steps: arrayGuard(RELATION_GUARD),
  targetPath: PATH_GUARD
}, { description: 'a derived relation' });

const GET_DERIVED_RELATIONS_OPTIONS_GUARD = optionsGuard<LabelledLinksGetDerivedRelationsOptions>({
  includeSubLabels: BOOLEAN_GUARD,
  label: LABEL_GUARD
}, { description: 'derived relation filters' });

/**
 * The contract this plugin publishes with {@link LabelledLinksApi}, for a consumer to pass as the `contract`
 * when it looks the API up.
 */
export const LABELLED_LINKS_API_CONTRACT = defineApiContract<LabelledLinksApi>({
  getDerivedRelations: {
    input: createArgumentsSchema([
      unionGuard(PATH_GUARD, instanceOfGuard(TFile)),
      optionalGuard(GET_DERIVED_RELATIONS_OPTIONS_GUARD)
    ]),
    output: createTypeGuardSchema(arrayGuard(DERIVED_RELATION_GUARD))
  },
  getInverseLabel: {
    input: createArgumentsSchema([LABEL_GUARD]),
    output: createTypeGuardSchema(NULLABLE_LABEL_GUARD)
  },
  getRelations: {
    input: createArgumentsSchema([
      unionGuard(PATH_GUARD, instanceOfGuard(TFile)),
      optionalGuard(GET_RELATIONS_OPTIONS_GUARD)
    ]),
    output: createTypeGuardSchema(arrayGuard(RELATION_GUARD))
  }
});
