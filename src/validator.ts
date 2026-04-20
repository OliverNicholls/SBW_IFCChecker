export interface StreamBIMObjectData {
  guid: string;
  name?: string;
  type?: string;
  properties: Record<string, any>;
}

export interface ValidationIssue {
  message: string;
  id?: string;
  objectGuid?: string;
  objectName?: string;
  objectType?: string;
}

export interface ValidationResult {
  pass: boolean;
  totalChecks: number;
  failures: ValidationIssue[];
  warnings: ValidationIssue[];
  summary: {
    validSpecifications: number;
    applicableRules: number;
    failedRules: number;
    affectedObjects: string[];
  };
}

export class IDSValidator {
  async validate(ifcFile: File, idsFile: File): Promise<ValidationResult> {
    try {
      const ifcContent = await this.readFile(ifcFile);
      const idsContent = await this.readFile(idsFile);

      // Parse IDS XML specification
      const idsSpec = this.parseIDSSpecification(idsContent);

      // Parse IFC content (JSON or IFC format)
      const ifcModel = this.parseIFCModel(ifcContent, ifcFile.name);

      // Validate against IDS specification
      return this.validateIFCAgainstIDS(ifcModel, idsSpec);
    } catch (error) {
      throw new Error(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async validateForObjects(
    ifcFile: File,
    idsFile: File,
    filterGuids: string[]
  ): Promise<ValidationResult> {
    const result = await this.validate(ifcFile, idsFile);

    if (filterGuids.length === 0) return result;

    const filterSet = new Set(filterGuids);
    const filteredFailures = result.failures.filter(issue => issue.objectGuid && filterSet.has(issue.objectGuid));
    const filteredWarnings = result.warnings.filter(issue => issue.objectGuid && filterSet.has(issue.objectGuid));

    const affectedObjects = new Set<string>();
    filteredFailures.forEach(issue => {
      if (issue.objectGuid) affectedObjects.add(issue.objectGuid);
    });
    filteredWarnings.forEach(issue => {
      if (issue.objectGuid) affectedObjects.add(issue.objectGuid);
    });

    return {
      pass: filteredFailures.length === 0,
      totalChecks: result.totalChecks,
      failures: filteredFailures,
      warnings: filteredWarnings,
      summary: {
        validSpecifications: result.summary.validSpecifications,
        applicableRules: result.summary.applicableRules,
        failedRules: filteredFailures.length,
        affectedObjects: Array.from(affectedObjects)
      }
    };
  }

  async validateStreamBIMObjects(
    objects: StreamBIMObjectData[],
    idsFile: File
  ): Promise<ValidationResult> {
    try {
      const idsContent = await this.readFile(idsFile);
      const idsSpec = this.parseIDSSpecification(idsContent);

      return this.validateStreamBIMObjectsAgainstIDS(objects, idsSpec);
    } catch (error) {
      throw new Error(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private validateStreamBIMObjectsAgainstIDS(
    objects: StreamBIMObjectData[],
    idsSpec: any
  ): ValidationResult {
    const affectedObjects = new Set<string>();

    const result: ValidationResult = {
      pass: true,
      totalChecks: 0,
      failures: [],
      warnings: [],
      summary: {
        validSpecifications: 0,
        applicableRules: 0,
        failedRules: 0,
        affectedObjects: []
      }
    };

    if (objects.length === 0) {
      result.warnings.push({ message: 'No objects to validate' });
      return result;
    }

    if (!idsSpec?.specifications || idsSpec.specifications.length === 0) {
      result.warnings.push({ message: 'No IDS specifications found to validate against' });
      return result;
    }

    for (const spec of idsSpec.specifications) {
      result.summary.validSpecifications++;
      result.totalChecks += spec.rules.length;

      for (const rule of spec.rules) {
        result.summary.applicableRules++;

        for (const obj of objects) {
          const ruleValid = this.validateRuleAgainstStreamBIMObject(obj, rule);

          if (!ruleValid) {
            result.pass = false;
            result.summary.failedRules++;

            const message = `[${spec.name}] ${rule.description || rule.id}`;
            const issue: ValidationIssue = {
              message,
              id: rule.id,
              objectGuid: obj.guid,
              objectName: obj.name,
              objectType: obj.type
            };

            if (rule.severity === 'error') {
              result.failures.push(issue);
            } else if (rule.severity === 'warning') {
              result.warnings.push(issue);
            }

            affectedObjects.add(obj.guid);
          }
        }
      }
    }

    result.summary.affectedObjects = Array.from(affectedObjects);
    return result;
  }

  private validateRuleAgainstStreamBIMObject(obj: StreamBIMObjectData, rule: any): boolean {
    if (!rule.xpath) {
      return true;
    }

    const parts = rule.xpath.split('/').filter((p: string) => p);

    let current: any = obj.properties;
    for (const part of parts) {
      if (current && typeof current === 'object') {
        current = current[part];
      } else {
        return false;
      }
    }

    return current !== undefined && current !== null;
  }

  private readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
      reader.readAsText(file);
    });
  }

  private parseIDSSpecification(content: string): any {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(content, 'text/xml');

      if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
        throw new Error('Invalid IDS XML format');
      }

      const specifications: any[] = [];
      const specElements = xmlDoc.getElementsByTagName('Specification');

      for (let i = 0; i < specElements.length; i++) {
        const specElem = specElements[i];
        const name = specElem.getAttribute('name') || `Specification ${i + 1}`;
        const ifcVersion = specElem.getAttribute('ifcVersion') || 'IFC4';
        const description = specElem.getAttribute('description') || '';

        const rules: any[] = [];
        const requirementElements = specElem.getElementsByTagName('Requirement');

        for (let j = 0; j < requirementElements.length; j++) {
          const req = requirementElements[j];
          const ruleId = req.getAttribute('id') || `rule_${i}_${j}`;
          const severity = req.getAttribute('severity') || 'error';
          const description = req.getAttribute('description') || req.textContent?.trim() || '';

          rules.push({
            id: ruleId,
            description,
            severity,
            xpath: req.getAttribute('xpath'),
            applicability: this.parseApplicability(req)
          });
        }

        specifications.push({
          id: specElem.getAttribute('id') || `spec_${i}`,
          name,
          ifcVersion,
          description,
          rules
        });
      }

      return { specifications };
    } catch (error) {
      throw new Error(`Failed to parse IDS: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseApplicability(element: Element): any {
    const applicability = element.getElementsByTagName('Applicability');
    if (applicability.length === 0) return null;

    const rules: any[] = [];
    for (let i = 0; i < applicability[0].children.length; i++) {
      const child = applicability[0].children[i];
      rules.push({
        type: child.tagName,
        value: child.getAttribute('value') || child.textContent?.trim()
      });
    }

    return rules;
  }

  private parseIFCModel(content: string, filename: string): any {
    const lowerFilename = filename.toLowerCase();

    if (lowerFilename.endsWith('.json') || lowerFilename.endsWith('.ifcjson')) {
      try {
        return JSON.parse(content);
      } catch (error) {
        throw new Error('Invalid IFC JSON format');
      }
    } else if (lowerFilename.endsWith('.ifc')) {
      return this.parseTextIFC(content);
    }

    throw new Error('Unsupported IFC format. Supported: .ifc, .ifcjson, .json');
  }

  private parseTextIFC(content: string): any {
    const lines = content.split('\n');
    const model: any = {
      header: {},
      entities: [],
      entityCount: 0,
      ifcVersion: 'Unknown'
    };

    let inData = false;
    let inHeader = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed === 'HEADER;') {
        inHeader = true;
        continue;
      }

      if (trimmed === 'ENDSEC;' && inHeader) {
        inHeader = false;
        continue;
      }

      if (trimmed === 'DATA;') {
        inData = true;
        continue;
      }

      if (trimmed === 'ENDSEC;' && inData) {
        inData = false;
        continue;
      }

      if (inHeader && trimmed.startsWith('FILE_SCHEMA')) {
        const match = trimmed.match(/FILE_SCHEMA\s*\(\('([^']+)'/);
        if (match) model.ifcVersion = match[1];
      }

      if (inData && trimmed && !trimmed.startsWith('/*')) {
        model.entities.push(trimmed);
        model.entityCount++;
      }
    }

    return model;
  }

  private validateIFCAgainstIDS(ifcModel: any, idsSpec: any): ValidationResult {
    const affectedObjects = new Set<string>();

    const result: ValidationResult = {
      pass: true,
      totalChecks: 0,
      failures: [],
      warnings: [],
      summary: {
        validSpecifications: 0,
        applicableRules: 0,
        failedRules: 0,
        affectedObjects: []
      }
    };

    // Validate IFC model is not empty
    if (!ifcModel || (ifcModel.entities?.length === 0 && Object.keys(ifcModel).length === 0)) {
      result.pass = false;
      result.failures.push({ message: 'IFC model is empty or invalid' });
      return result;
    }

    // Validate IDS specifications exist
    if (!idsSpec?.specifications || idsSpec.specifications.length === 0) {
      result.warnings.push({ message: 'No IDS specifications found to validate against' });
      return result;
    }

    // Process each specification
    for (const spec of idsSpec.specifications) {
      result.summary.validSpecifications++;
      result.totalChecks += spec.rules.length;

      for (const rule of spec.rules) {
        // Check if rule is applicable to this IFC model
        if (this.isRuleApplicable(ifcModel, spec, rule)) {
          result.summary.applicableRules++;

          // Validate the rule
          const ruleValid = this.validateRule(ifcModel, spec, rule);

          if (!ruleValid) {
            result.pass = false;
            result.summary.failedRules++;

            const message = `[${spec.name}] ${rule.description || rule.id}`;
            const issue: ValidationIssue = { message, id: rule.id };

            // Extract GUID if available from the model
            if (ifcModel.entities && ifcModel.entities.length > 0) {
              const guid = this.extractGuidFromEntity(ifcModel.entities[0]);
              if (guid) {
                issue.objectGuid = guid;
                affectedObjects.add(guid);
              }
            }

            if (rule.severity === 'error') {
              result.failures.push(issue);
            } else if (rule.severity === 'warning') {
              result.warnings.push(issue);
            }
          }
        }
      }
    }

    result.summary.affectedObjects = Array.from(affectedObjects);
    return result;
  }

  private extractGuidFromEntity(entity: any): string | undefined {
    if (typeof entity === 'string') {
      // Try to extract GUID from IFC text format
      const guidMatch = entity.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      if (guidMatch) return guidMatch[0];
    } else if (typeof entity === 'object') {
      // Try to find GUID in JSON object
      return entity.guid || entity.GlobalId || entity.id;
    }
    return undefined;
  }

  private isRuleApplicable(ifcModel: any, spec: any, rule: any): boolean {
    // If no applicability rules, it always applies
    if (!rule.applicability || rule.applicability.length === 0) {
      return true;
    }

    // Check if model version matches specification
    if (spec.ifcVersion && ifcModel.ifcVersion) {
      const modelVersion = ifcModel.ifcVersion.toLowerCase();
      const specVersion = spec.ifcVersion.toLowerCase();
      if (!modelVersion.includes(specVersion) && !specVersion.includes(modelVersion)) {
        return false;
      }
    }

    return true;
  }

  private validateRule(ifcModel: any, _spec: any, rule: any): boolean {
    // Basic validation checks
    if (ifcModel.entityCount === undefined && !Array.isArray(ifcModel.entities)) {
      // JSON-based IFC model
      return this.validateJSONRule(ifcModel, rule);
    } else {
      // Text-based IFC model
      return this.validateTextIFCRule(ifcModel);
    }
  }

  private validateJSONRule(ifcModel: any, rule: any): boolean {
    // Check if required properties exist in model
    // This is a simplified validation
    if (rule.xpath) {
      // XPath-like property checking
      return this.checkXPathExpression(ifcModel, rule.xpath);
    }

    // Default: model has content
    return Object.keys(ifcModel).length > 0;
  }

  private validateTextIFCRule(ifcModel: any): boolean {
    // For text IFC, check if entities exist
    if (ifcModel.entityCount === 0) {
      return false;
    }

    // Check for basic IFC structure validity
    return ifcModel.entities && ifcModel.entities.length > 0;
  }

  private checkXPathExpression(obj: any, xpath: string): boolean {
    // Simple XPath-like expression checker
    const parts = xpath.split('/').filter(p => p);

    let current = obj;
    for (const part of parts) {
      if (current && typeof current === 'object') {
        current = current[part];
      } else {
        return false;
      }
    }

    return current !== undefined && current !== null;
  }
}
