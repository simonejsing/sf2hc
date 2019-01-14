# Salesforce 2 Heroku Connect

This tool allows automatic generation of a Heroku Connect mappings definition from querying a Salesforce Org.

The tool creates a complete mapping of all Salesforce Objects that are replicatable using Heroku Connect and has existing rows in them.

As part of the process a local cache of the Salesforce Metadata is created on disk to allow rappid reruns.

In order to generate valid mapping json files, you need to update the `base_mapping.json` file and put in your Org details. The easiest way to obtain the information is to create a single mapping in Heroku Connect, export it, and extract the relevant information from that mapping.

## Building

To build the tool run the following commands:

`npm install`

`npm run build`

The generate the mappings file for your Salesforce Org run:

`npm run sf2hc`

## Authentication

The tool leverages an API user and expects a .credentials.json file to exist in the working directory with the following content:

```json
{
    "username": "<username>",
    "password": "<password>",
    "token": "<API token>"
}
```
