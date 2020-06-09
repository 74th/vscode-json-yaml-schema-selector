import * as vscode from 'vscode';
import { QuickPickItem } from 'vscode';

import { SchemaStore, Schema, SchemaCatalog } from './schema/schema';

interface JSONSchemaSetting {
    fileMatch: string[]
    url: string
}
type JSONSchemaSettings = JSONSchemaSetting[];
type YAMLSchemaSettings = { [label: string]: string[] };

class UserMessageError implements Error {

    message: string;
    name: string;

    constructor(message: string) {
        this.message = message;
        this.name = "UserMessageError";
    }
}

class InterruptionError implements Error {

    message: string;
    name: string;

    constructor(message: string) {
        this.message = message;
        this.name = "UserMessageError";
    }
}

class Extension {
    schemaStore: SchemaStore;

    constructor() {
        this.schemaStore = this.initSchemaStore();
        this.addUserSchemas();
    }

    private initSchemaStore = (): SchemaStore => {
        return new SchemaStore({
            repositoryURLs: [{
                name: "chemastore.ong",
                url: "http://schemastore.org/api/json/catalog.json",
            }]
        });
    };

    private addUserSchemas = () => {
        const userSchemas = vscode.workspace.getConfiguration("json-yaml-schema-selector").get("additionalSchemas") as (string | SchemaCatalog)[];
        userSchemas.forEach(schema => {
            if (typeof (schema) === "string") {
                this.schemaStore.addSchemas({
                    catalog: {
                        name: schema,
                        description: "user-setting",
                        url: schema,
                    },
                    org: "user-setting"
                });
            } else {
                if (!schema.description) {
                    schema.description = schema.name;
                }
                if (!schema.description) {
                    schema.description = schema.name;
                }
                this.schemaStore.addSchemas({
                    catalog: schema,
                    org: "user-setting"
                });
            }
        });
    };

    private fetchSchemas = async () => {
        await this.schemaStore.fetchSchemas();
    };

    private getActiveEditorDocumentPath = (): string => {
        return vscode.workspace.asRelativePath(vscode.window.activeTextEditor!.document.uri);
    };

    private selectSchema = async (filePath: string): Promise<Schema> => {

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

        function matchSelectedItemToSchema(schemas: Schema[], items: QuickPickItem[], selected: QuickPickItem): Schema {
            for (let i = 0; i < items.length; i++) {
                if (selected === items[i]) {
                    return schemas[i];
                }
            }
            throw new Error("wrong selection");
        }

        const filePathMatchScemas = this.schemaStore.selectSchemasWithFileMatch(filePath);

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
            const schemas = this.schemaStore.getAllSchemas();
            const items = createSchemaSelectItems(schemas);
            if (schemas.length === 0) {
                throw new UserMessageError("cannot fetch any schemas");
            }
            const selected = await vscode.window.showQuickPick(items, { canPickMany: false });
            if (selected) {
                selectedSchema = matchSelectedItemToSchema(schemas, items, selected);
            }
        }
        if (!selectedSchema) {
            throw new InterruptionError("does not select schema");
        }
        return selectedSchema;
    };

    private selectSchemaURL = async (schema: Schema): Promise<string> => {

        function createVersionSelectItems(schema: Schema): QuickPickItem[] {
            const items: QuickPickItem[] = [{ label: "latest" }];
            for (let key of Object.keys(schema.catalog.versions!)) {
                items.push({
                    label: key,
                });
            }
            return items;
        }

        if (!schema.catalog.versions) {
            return schema.catalog.url as string;
        }
        const items = createVersionSelectItems(schema);
        const selected = await vscode.window.showQuickPick(items, { canPickMany: false });
        if (!selected) {
            throw new Error("does not select schema version");
        }
        if (selected.label === "latest") {
            return schema.catalog.url as string;
        }
        return schema.catalog.versions[selected.label] as string;
    };

    private detectJSONorYAML = async (scheme: Schema): Promise<string> => {
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

        const selected = await vscode.window.showQuickPick(["json", "yaml"], { canPickMany: false });
        if (selected) {
            return selected;
        }
        throw new InterruptionError("does not select json/yaml");
    };

    private insertJSONConfiguration = (filePath: string, schemaURL: string) => {
        let config = vscode.workspace.getConfiguration("json");
        let settings = config.get("schemas") as JSONSchemaSettings;
        const update = { fileMatch: [filePath], url: schemaURL! };
        if (settings) {
            settings.push(update);
        } else {
            settings = [update];
        }
        config.update("schemas", settings, false);
    };

    private insertYAMLConfiguration = (filePath: string, schemaURL: string) => {
        let config = vscode.workspace.getConfiguration("yaml");
        let settings = config.get("schemas") as YAMLSchemaSettings;
        if (!settings) {
            settings = {};
        }
        if (!settings[schemaURL]) {
            settings[schemaURL] = [];
        }
        settings[schemaURL].push(filePath);
        config.update("schemas", settings, false);
    };

    public runSelectSchema = async () => {

        if (!vscode.window.activeTextEditor) {
            return;
        }

        try {
            await this.fetchSchemas();
            const filePath = this.getActiveEditorDocumentPath();
            const schema = await this.selectSchema(filePath);
            const selectedSchemaURL = await this.selectSchemaURL(schema);
            const detectedType = await this.detectJSONorYAML(schema);
            if (detectedType === "json") {
                this.insertJSONConfiguration(filePath, selectedSchemaURL);
            } else if (detectedType === "yaml") {
                this.insertYAMLConfiguration(filePath, selectedSchemaURL);
            }
        } catch (err) {
            if (err instanceof UserMessageError) {
                vscode.window.showErrorMessage(err.message);
                return;
            }
            if (err instanceof UserMessageError) {
                return;
            }
            throw err;
        }

    };
}

export function activate(ctx: vscode.ExtensionContext) {

    let ext: Extension | null = null;

    ctx.subscriptions.push(
        vscode.commands.registerCommand('json-yaml-schema-selector.selectSchemaFromFileMatch', async () => {
            if (!ext) {
                ext = new Extension();
            }
            ext.runSelectSchema();
        })
    );

    ctx.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(() => {
            ext = null;
        })
    );
}


// this method is called when your extension is deactivated
export function deactivate() { }
