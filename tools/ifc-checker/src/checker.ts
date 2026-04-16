/**
 * IDS Checking Logic
 * Maps IDS specifications to StreamBIM API queries and validates results
 */

import { IDSSpecification, IDSFacet } from './ids-parser';

export interface ObjectResult {
  guid: string;
  name: string;
  passed: boolean;
  failedRequirements: string[];
}

export interface SpecificationResult {
  specification: IDSSpecification;
  applicableCount: number;
  passedCount: number;
  failedCount: number;
  failedObjects: ObjectResult[];
  passedObjects: ObjectResult[];
  status: 'pass' | 'fail' | 'not_applicable' | 'error';
  errorMessage?: string;
}

interface ObjectSearchQuery {
  rules: Array<{
    psetName?: string;
    propKey?: string;
    value?: string;
  }>;
}

interface ObjectInfo {
  guid: string;
  name: string;
  ifcProperties?: Record<string, string>;
  properties?: Record<string, string>;
  [key: string]: any;
}

/**
 * Run an IDS specification check against the model via StreamBIM API
 */
export async function checkSpecification(
  spec: IDSSpecification,
  streamBIM: any
): Promise<SpecificationResult> {
  try {
    // Build applicability query
    const applicabilityQuery = facetsToQuery(spec.applicability);

    // Get all applicable objects
    let applicableObjects: ObjectInfo[] = [];
    if (applicabilityQuery.rules.length > 0) {
      try {
        applicableObjects = await streamBIM.getObjectInfoForSearch(applicabilityQuery);
      } catch (err) {
        return {
          specification: spec,
          applicableCount: 0,
          passedCount: 0,
          failedCount: 0,
          failedObjects: [],
          passedObjects: [],
          status: 'error',
          errorMessage: `Failed to query applicable objects: ${(err as Error).message}`,
        };
      }
    } else {
      // No applicability filters - would need to check all objects (not practical)
      return {
        specification: spec,
        applicableCount: 0,
        passedCount: 0,
        failedCount: 0,
        failedObjects: [],
        passedObjects: [],
        status: 'not_applicable',
        errorMessage: 'No applicability facets defined',
      };
    }

    if (applicableObjects.length === 0) {
      return {
        specification: spec,
        applicableCount: 0,
        passedCount: 0,
        failedCount: 0,
        failedObjects: [],
        passedObjects: [],
        status: 'pass', // Vacuously true - no applicable objects
      };
    }

    // Check requirements for each applicable object
    const failedObjects: ObjectResult[] = [];
    const passedObjects: ObjectResult[] = [];

    for (const obj of applicableObjects) {
      const failedReqs = checkRequirements(spec.requirements, obj);
      const objectResult: ObjectResult = {
        guid: obj.guid,
        name: obj.name || 'Unnamed Object',
        passed: failedReqs.length === 0,
        failedRequirements: failedReqs,
      };

      if (objectResult.passed) {
        passedObjects.push(objectResult);
      } else {
        failedObjects.push(objectResult);
      }
    }

    const status = failedObjects.length === 0 ? 'pass' : 'fail';

    return {
      specification: spec,
      applicableCount: applicableObjects.length,
      passedCount: passedObjects.length,
      failedCount: failedObjects.length,
      failedObjects,
      passedObjects,
      status,
    };
  } catch (err) {
    return {
      specification: spec,
      applicableCount: 0,
      passedCount: 0,
      failedCount: 0,
      failedObjects: [],
      passedObjects: [],
      status: 'error',
      errorMessage: `Unexpected error: ${(err as Error).message}`,
    };
  }
}

/**
 * Convert IDS facets to StreamBIM ObjectSearchQuery rules
 */
function facetsToQuery(facets: IDSFacet[]): ObjectSearchQuery {
  const rules: ObjectSearchQuery['rules'] = [];

  for (const facet of facets) {
    switch (facet.type) {
      case 'entity':
        if (facet.entityName) {
          rules.push({
            psetName: 'Ifc2x3~Object',
            propKey: 'ifcclass',
            value: facet.entityName,
          });
        }
        break;

      case 'property':
        if (facet.psetName && facet.propertyName) {
          rules.push({
            psetName: facet.psetName,
            propKey: facet.propertyName,
            value: facet.value ? String(facet.value) : undefined,
          });
        }
        break;

      case 'attribute':
        if (facet.propertyName) {
          rules.push({
            psetName: 'Ifc2x3~Object',
            propKey: facet.propertyName,
            value: facet.value ? String(facet.value) : undefined,
          });
        }
        break;

      case 'material':
        if (facet.value) {
          rules.push({
            psetName: 'Ifc2x3~Object',
            propKey: 'Material',
            value: String(facet.value),
          });
        }
        break;

      // classification and partOf not yet supported in query conversion
      case 'classification':
      case 'partOf':
        console.warn(`Facet type '${facet.type}' not yet supported in queries`);
        break;
    }
  }

  return { rules };
}

/**
 * Check if an object meets all requirement facets
 * Returns array of failure reasons (empty = all passed)
 */
function checkRequirements(requirements: IDSFacet[], obj: ObjectInfo): string[] {
  const failures: string[] = [];

  for (const req of requirements) {
    const failure = checkFacetRequirement(req, obj);
    if (failure) {
      failures.push(failure);
    }
  }

  return failures;
}

/**
 * Check a single requirement facet against an object
 * Returns failure reason string, or null if passed
 */
function checkFacetRequirement(facet: IDSFacet, obj: ObjectInfo): string | null {
  const ifcProps = obj.ifcProperties || {};

  switch (facet.type) {
    case 'entity':
      // Entity applicability is already filtered, so this always passes in requirements
      return null;

    case 'property':
      if (!facet.psetName || !facet.propertyName) {
        return `Invalid property facet (missing pset or property name)`;
      }

      // Property key format: "psetName~propertyName"
      const propKey = `${facet.psetName}~${facet.propertyName}`;
      const propValue = ifcProps[propKey];

      // Check if property exists
      if (propValue === undefined || propValue === null || propValue === '') {
        return `Property '${facet.propertyName}' not found in '${facet.psetName}'`;
      }

      // Check value if specified
      if (facet.value) {
        if (Array.isArray(facet.value)) {
          // Enumeration check
          if (!facet.value.includes(propValue)) {
            return `Property '${facet.propertyName}' has value '${propValue}', expected one of: ${facet.value.join(', ')}`;
          }
        } else if (typeof facet.value === 'string') {
          // Exact match or pattern check
          if (facet.value.startsWith('[') && facet.value.endsWith(']')) {
            // Numeric range [min..max]
            // For now, just check that value matches the constraint semantically
            // Full numeric comparison would require parsing and type info
            return null; // TODO: implement numeric range checks
          } else {
            if (propValue !== facet.value) {
              return `Property '${facet.propertyName}' has value '${propValue}', expected '${facet.value}'`;
            }
          }
        }
      }
      return null;

    case 'attribute':
      if (!facet.propertyName) {
        return `Invalid attribute facet (missing property name)`;
      }

      // Attributes are stored in ifcProperties with Ifc2x3~Object prefix
      const attrKey = `Ifc2x3~Object~${facet.propertyName}`;
      const attrValue = ifcProps[attrKey];

      if (attrValue === undefined || attrValue === null || attrValue === '') {
        return `Attribute '${facet.propertyName}' not found`;
      }

      if (facet.value) {
        if (Array.isArray(facet.value)) {
          if (!facet.value.includes(attrValue)) {
            return `Attribute '${facet.propertyName}' has value '${attrValue}', expected one of: ${facet.value.join(', ')}`;
          }
        } else if (typeof facet.value === 'string') {
          if (attrValue !== facet.value) {
            return `Attribute '${facet.propertyName}' has value '${attrValue}', expected '${facet.value}'`;
          }
        }
      }
      return null;

    case 'material':
      if (!facet.value) {
        return `Material facet must have a value`;
      }

      const materialKey = 'Ifc2x3~Object~Material';
      const materialValue = ifcProps[materialKey];

      if (!materialValue) {
        return `No material assigned`;
      }

      if (Array.isArray(facet.value)) {
        if (!facet.value.includes(materialValue)) {
          return `Material '${materialValue}' not in allowed list: ${facet.value.join(', ')}`;
        }
      } else if (typeof facet.value === 'string') {
        if (materialValue !== facet.value) {
          return `Material '${materialValue}', expected '${facet.value}'`;
        }
      }
      return null;

    case 'classification':
    case 'partOf':
      return `Facet type '${facet.type}' validation not yet implemented`;

    default:
      return `Unknown facet type`;
  }
}
