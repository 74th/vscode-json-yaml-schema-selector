import * as request from "request-promise";
import { Schema } from "inspector";
import * as minimatch from "minimatch";

export interface Config {
    repositoryURLs: RepositoryURL[]
}

export interface RepositoryURL {
    url: string
    name: string
}

export interface SchemaCatalog {
    name: string
    description: string
    fileMatch?: string[]
    url?: string
    versions?: { [index: string]: string; }
}

export interface SchemaCatalogs {
    version: number;
    schemas: SchemaCatalog[];
}

export interface Schema {
    org: string
    catalog: SchemaCatalog

}
const fetchSchema = async (repo: RepositoryURL): Promise<Schema[]> => {
    const res = JSON.parse(await request(repo.url)) as SchemaCatalogs;
    const schemas = res.schemas.map<Schema>((schema) => {
        return {
            catalog: schema,
            org: repo.name,
        };
    });
    return schemas;
};

const matchSchema = (fileURI: string, schema: Schema): boolean => {

    if (schema.catalog.fileMatch) {
        for (let pattern of schema.catalog.fileMatch) {
            const r = minimatch.match([fileURI], pattern);
            if (r.length > 0) {
                return true;
            }
        }
    }
    return false;
};

export class SchemaStore {

    private conf: Config;
    private schemas: Schema[];
    private alreadyFetched: boolean;

    constructor(conf: Config) {
        this.conf = conf;
        this.schemas = [];
        this.alreadyFetched = false;
    }

    fetchSchemas = async () => {
        if (this.alreadyFetched) {
            return;
        }
        for (let repo of this.conf.repositoryURLs) {
            const schemas = await fetchSchema(repo);
            this.schemas = this.schemas.concat(schemas);
        }
        this.alreadyFetched = true;
    };

    selectSchemasWithFileMatch = (fileURI: string): Schema[] => {
        return this.schemas.filter((schema) => {
            return matchSchema(fileURI, schema);
        });
    };

    getAllSchemas = (): Schema[] => {
        return this.schemas;
    };

    addSchemas = (schema: Schema) => {
        this.schemas.push(schema)
    }
}
