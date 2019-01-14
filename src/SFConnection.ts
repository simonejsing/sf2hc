import * as sf from 'jsforce';
import * as util from 'util';

export interface ISObjectFieldMetadata {
    name: string;
    type: string;
    externalId: boolean;
    unique: boolean;
}

export interface ISObjectMetadata {
    name: string;
    label: string;

    custom: boolean;
    queryable: boolean;
    retrieveable: boolean;
    replicateable: boolean;
    deletable: boolean;
    deprecatedAndHidden: boolean;

    fields: ISObjectFieldMetadata[];

    // Calculated properties
    rowCount?: number;
}

export class SFConnection {
    private conn: sf.Connection = new sf.Connection({ loginUrl: 'https://login.salesforce.com' });

    constructor() {
        this.conn.asyncLogin = util.promisify(this.conn.login);
        this.conn.asyncDescribeGlobal = util.promisify(this.conn.describeGlobal);
        this.conn.asyncQuery = util.promisify(this.conn.query);
    }

    public async login(username: string, password: string): Promise<any> {
        return this.conn.asyncLogin(username, password);
    }

    public async listSObjects(): Promise<any> {
        return this.conn.asyncDescribeGlobal().then(r => r.sobjects);
    }

    public async describe(name: string): Promise<ISObjectMetadata> {
        const object = this.conn.sobject(name);
        object.asyncDescribe = util.promisify(object.describe);
        return object.asyncDescribe();
    }

    public async getRowCount(name: string): Promise<{ rows: number }> {
        return this.conn.asyncQuery(`SELECT COUNT() FROM ${name}`).then(r => { return { rows: r.totalSize }; });
    }
}
