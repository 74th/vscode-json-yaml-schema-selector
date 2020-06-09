import * as vscode from 'vscode';
import { QuickPickItem } from 'vscode';

import { SchemaStore, Schema, SchemaCatalog } from './schema/schema';

interface JSONSchemaSetting {
    fileMatch: string[]
    url: string
}
type JSONSchemaSettings = JSONSchemaSetting[];
type YAMLSchemaSettings = { [label: string]: string[] };

function createSchemaSelectItems(schemas: Schema[]): QuickPickItem[] {
    const items: QuickPickItem[] = [];
    for (let schema of schemas) {
        items.push({
            label: schema.catalog.name,
            description: `${schema.catalog.description} (${schema.org})`,
        });
    }
    return items;
}

function createVersionSelectItems(schema: Schema): QuickPickItem[] {
    const items: QuickPickItem[] = [{ label: "latest" }];
    for (let key of Object.keys(schema.catalog.versions!)) {
        items.push({
            label: key,
        });
    }
    return items;
}

function matchSelectedItemToSchema(schemas: Schema[], items: QuickPickItem[], selected: QuickPickItem): Schema {
    for (let i = 0; i < items.length; i++) {
        if (selected === items[i]) {
            return schemas[i];
        }
    }
    throw new Error("wrong selection");
}

function detectJSONorYAML(scheme: Schema): string | undefined {
    if (vscode.window.activeTextEditor!.document.languageId === "json" || vscode.window.activeTextEditor!.document.languageId === "jsonc") {
        return "json";
    }
    if (vscode.window.activeTextEditor!.document.languageId === "yaml") {
        return "yaml";
    }
    const fileName = vscode.window.activeTextEditor!.document.fileName.toLowerCase();
    if (fileName) {
        if (fileName.endsWith(".yaml") || fileName.endsWith(".yml")) {
            return "yaml";
        }
        if (fileName.endsWith(".json") || fileName.endsWith(".jsonc")) {
            return "json";
        }
        if (fileName.includes(".yaml") || fileName.includes(".yml")) {
            return "yaml";
        }
        if (fileName.includes(".json") || fileName.includes(".jsonc")) {
            return "json";
        }
    }
    if (scheme.catalog.fileMatch) {
        for (let match of scheme.catalog.fileMatch) {
            if (match.includes(".yaml") || match.includes(".yml")) {
                return "yaml";
            }
            if (match.includes(".json") || match.includes(".jsonc")) {
                return "json";
            }
        }
    }

    return undefined;
}

let schemaStore = initSchemaStore()

function initSchemaStore(): SchemaStore {
    return new SchemaStore({
        repositoryURLs: [{
            name: "chemastore.ong",
            url: "http://schemastore.org/api/json/catalog.json",
        }]
    });
}


export function activate(context: vscode.ExtensionContext) {

    let disposable = vscode.commands.registerCommand('json-yaml-schema-selector.selectSchemaFromFileMatch', async () => {
        await schemaStore.fetchSchemas();

        if (!vscode.window.activeTextEditor) {
            return;
        }

        const userSchemas = vscode.workspace.getConfiguration("json-yaml-schema-selector").get("additionalSchemas") as (string | SchemaCatalog)[];
        userSchemas.forEach(schema => {
            if (typeof (schema) == "string") {
                schemaStore.addSchemas({
                    catalog: {
                        name: schema,
                        description: "user-setting",
                        url: schema,
                    },
                    org: "user-setting"
                })
            } else {
                if (!schema.description) {
                    schema.description = schema.name
                }
                if (!schema.description) {
                    schema.description = schema.name
                }
                schemaStore.addSchemas({
                    catalog: schema,
                    org: "user-setting"
                })
            }
        })

        const filePath = vscode.workspace.asRelativePath(vscode.window.activeTextEditor.document.uri);
        const filePathMatchScemas = schemaStore.selectSchemasWithFileMatch(filePath);

        let selectedSchema: Schema | null = null;

        if (filePathMatchScemas.length > 0) {
            const items = createSchemaSelectItems(filePathMatchScemas);
            items.push({ label: "others" });
            const selected = await vscode.window.showQuickPick(items, { canPickMany: false });
            if (selected && selected.label !== "others") {
                selectedSchema = matchSelectedItemToSchema(filePathMatchScemas, items, selected);
            }
        }

        if (!selectedSchema) {
            const schemas = schemaStore.getAllSchemas();
            const items = createSchemaSelectItems(schemas);
            if (schemas.length === 0) {
                vscode.window.showErrorMessage("cannot fetch any schemas");
                return;
            }
            const selected = await vscode.window.showQuickPick(items, { canPickMany: false });
            if (selected) {
                selectedSchema = matchSelectedItemToSchema(schemas, items, selected);
            }
        }
        if (!selectedSchema) {
            return;
        }

        let selectedSchemaURL: string | undefined;

        if (selectedSchema.catalog.versions) {
            const items = createVersionSelectItems(selectedSchema);
            const selected = await vscode.window.showQuickPick(items, { canPickMany: false });
            if (!selected) {
                return;
            }
            if (selected.label === "latest") {
                selectedSchemaURL = selectedSchema.catalog.url as string;
            } else {
                selectedSchemaURL = selectedSchema.catalog.versions[selected.label] as string;
            }
        } else {
            selectedSchemaURL = selectedSchema.catalog.url as string;
        }

        let detectedType = detectJSONorYAML(selectedSchema);
        if (!detectedType) {
            detectedType = await vscode.window.showQuickPick(["json", "yaml"], { canPickMany: false });
        }
        if (detectedType === "json") {
            let config = vscode.workspace.getConfiguration("json");
            let settings = config.get("schemas") as JSONSchemaSettings;
            const update = { fileMatch: [filePath], url: selectedSchemaURL! };
            if (settings) {
                settings.push(update);
            } else {
                settings = [update];
            }
            config.update("schemas", settings, false);
        } else if (detectedType === "yaml") {
            let config = vscode.workspace.getConfiguration("yaml");
            let settings = config.get("schemas") as YAMLSchemaSettings;
            if (!settings) {
                settings = {};
            }
            if (!settings[selectedSchemaURL]) {
                settings[selectedSchemaURL] = [];
            }
            settings[selectedSchemaURL].push(filePath);
            config.update("schemas", settings, false);
        }
    });
    context.subscriptions.push(disposable);

    disposable = vscode.workspace.onDidChangeConfiguration(() => {
        schemaStore = initSchemaStore();
    });
    context.subscriptions.push(disposable);
}


// this method is called when your extension is deactivated
export function deactivate() { }
