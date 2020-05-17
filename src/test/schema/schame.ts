import * as schema from "../../schema/schema";
import { describe, Suite, it } from "mocha";

import * as assert from 'assert';

const json_shcema_org = "http://schemastore.org/api/json/catalog.json";

describe('schema', () => {
    it('fetches a schema', async () => {
        const sc = new schema.SchemaStore({
            repositoryURLs: [{
                name: "chemastore.ong",
                url: json_shcema_org
            }],
        });

        await sc.fetchSchemas();
        let r = sc.selectSchemasWithFileMatch("kustomization.yaml");
        assert.equal(r.length, 1);
        sc.fetchSchemas();
    });
});
