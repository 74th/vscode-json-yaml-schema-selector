# JSON & YAML Schema elector

Setting a schemas to your JSON and YAML file quickly.

# How to use

open JSON or YAML file

![open JSON or YAML file](https://raw.githubusercontent.com/74th/vscode-json-yaml-schema-selector/master/docs/open-file.png)

run command "Select JSON/YAML Schema from file match"

!["Select JSON/YAML Schema from file match"](https://raw.githubusercontent.com/74th/vscode-json-yaml-schema-selector/master/docs/run-command.png)

select json schemas

![select json schemas](https://raw.githubusercontent.com/74th/vscode-json-yaml-schema-selector/master/docs/select-schema.png)

use schema

![use schema](https://raw.githubusercontent.com/74th/vscode-json-yaml-schema-selector/master/docs/use-schema.png)

this will set the schema to settings.json

![settings.json](https://raw.githubusercontent.com/74th/vscode-json-yaml-schema-selector/master/docs/settings.png)

# using schemas

This uses [JSON Schema Store](https://www.schemastore.org/json/).

## how to add schemas

Please add your settings.

```json
{
  "json-yaml-schema-selector.additionalSchemas": [
    // url
    "https://raw.githubusercontent.com/docker/compose/master/compose/config/config_schema_v3.8.json",
    // object
    {
      "name": "docker-compose",
      "description": "docker-compose 3.8",
      "url": "https://raw.githubusercontent.com/docker/compose/master/compose/config/config_schema_v3.8.json",
      "fileMatch": ["docker-compose.yaml"]
    }
  ]
}
```

# License

MIT

# Change Log

## 1.1.0

- supporting jsonc as json

## 1.0.0

- first version

# thanks

Icon used from [freeicons.io](https://freeicons.io)
