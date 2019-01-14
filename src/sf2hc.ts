const sf = require('jsforce');

import * as fs from 'fs';
import * as os from 'os';
import { SFConnection, ISObjectMetadata, ISObjectFieldMetadata } from './SFConnection';
import { MetadataCrawler } from './MetadataCrawler';
import { IHerokuMapping, IHerokuConfiguration } from './IHerokuMapping';

interface IIndexDefinition {
    name: string;
    unique: boolean;
}

function isUnsupportedFieldType(field: ISObjectFieldMetadata): boolean {
    const unsupportedFieldTypes = {
        // Binary field types
        base64: true,

        // Compound field types
        address: true,
        location: true,
    };
    return unsupportedFieldTypes[field.type] !== undefined;
}

function createHerokuMapping(obj: ISObjectMetadata): IHerokuMapping {
    const enabledFields = obj.fields.filter(f => !isUnsupportedFieldType(f));
    const fieldsToMap: object = enabledFields.reduce((acc, cur, i) => {
        acc[cur.name] = {};
        return acc;
    }, {});

    const externalIndexes: IIndexDefinition[] =
        enabledFields
        .filter(f => f.externalId)
        .map(f => { return { name: f.name, unique: f.unique }; });
    const knownIndexFields = new Array<IIndexDefinition>(
        { name: "Id", unique: true },
        { name: "SystemModstamp", unique: false },
        { name: "LastModifiedDate", unique: false },
    );
    const allIndexes = knownIndexFields.concat(externalIndexes);

    const enabledIndexes: IIndexDefinition[] = allIndexes.filter(i => fieldsToMap[i.name] !== undefined);
    const indexesToMap: object = enabledIndexes.reduce((acc, cur, i) => {
        acc[cur.name] = {
            unique: cur.unique
        };
        return acc;
    }, {});

    return {
        object_name: obj.name,
        config: {
            access: "read_only",
            sf_notify_enabled: false,
            sf_polling_seconds: 3600,
            sf_max_daily_api_calls: 30000,
            fields: fieldsToMap,
            indexes: indexesToMap
        },
    };
}

async function run() {
    const credentials: ICredentials = JSON.parse(fs.readFileSync('.credentials.json', 'utf8'));
    const conn: SFConnection = new SFConnection();
    const crawler: MetadataCrawler = new MetadataCrawler(conn, 'cache');

    const userInfo = await conn.login(credentials.username, credentials.password + credentials.token);
    console.log("User ID: " + userInfo.id);
    console.log("Org ID: " + userInfo.organizationId);

    await crawler.crawl();

    const numberObjects = crawler.SObjects.length;
    const customObjects = crawler.SObjects.filter(o => o.custom === true).length;
    const noneQueriableObjects = crawler.SObjects.filter(o => o.queryable === false).length;
    const noneRetrievable = crawler.SObjects.filter(o => o.retrieveable === false).length;
    const noneReplicateable = crawler.SObjects.filter(o => o.replicateable === false).length;
    const noneZeroRowCounts = crawler.SObjects.filter(o => o.rowCount > 0).length;

    console.log(`#: ${numberObjects}`);
    console.log(`Custom: ${customObjects}`);
    console.log(`!Queriable: ${noneQueriableObjects}`);
    console.log(`!Retrieveable: ${noneRetrievable}`);
    console.log(`!Replicateable: ${noneReplicateable}`);
    console.log(`!ZeroRows: ${noneZeroRowCounts}`);

    const blacklist = {
        // Known history tables
        casehistory: true,
        contracthistory: true,
        leadhistory: true,
        opportunityfieldhistory: true,
        opportunityhistory: true,
        processinstancehistory: true,
        quantityforecasthistory: true,
        revenueforecasthistory: true,
        solutionhistory: true,
        workbadgedefinitionhistory: true,
        // PII concerns
        lead: true,
        contact: true,
    };
    const interestingObjects = crawler.SObjects.filter(
        o =>
            o.replicateable &&
            o.rowCount > 0 &&
            (blacklist[o.name.toLowerCase()] === undefined) &&
            !o.name.endsWith('History') &&
            !o.name.endsWith('History__c')
        );

    console.log(`Interesting: ${interestingObjects.length}`);

    const names = interestingObjects.map(o => o.name);
    fs.writeFileSync("interesting.txt", names.join(os.EOL));

    const baseMapping = JSON.parse(fs.readFileSync('base_mapping.json', { encoding: 'utf8' })) as IHerokuConfiguration;

    let done = false;
    let iteration = 0;
    const size = 100;
    while (!done) {
        const startIndex = iteration * size;
        const endIndex = (iteration + 1) * size;
        const objectMappings = interestingObjects.slice(startIndex, endIndex).map(createHerokuMapping);

        baseMapping.mappings = objectMappings;
        fs.writeFileSync(`mapping${iteration}.json`, JSON.stringify(baseMapping, undefined, 4));

        iteration += 1;
        done = endIndex >= interestingObjects.length;
    }

}

run();
