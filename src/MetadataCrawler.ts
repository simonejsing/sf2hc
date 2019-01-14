import * as util from 'util';
import * as fs from 'fs';
import * as mkdirp from 'mkdirp';
import * as p from 'path';
import { ISObjectMetadata, SFConnection } from './SFConnection';

export class MetadataCrawler {
    private asyncWriteFile = util.promisify(fs.writeFile);
    private conn: SFConnection;
    private cacheRoot: string;

    public SObjects: ISObjectMetadata[];

    constructor(conn: SFConnection, cacheRoot: string) {
        this.conn = conn;
        this.cacheRoot = cacheRoot;
    }

    public async crawl() {
        const globalObjects: Array<any> = await this.readWithCache("global", "sobjects.json", () => this.conn.listSObjects());

        const objs = globalObjects.map<Promise<ISObjectMetadata | undefined>>(obj => {
            return this.readWithCache(
                "objects",
                `${obj.name}.json`,
                () => this.conn.describe(obj.name))
                .catch(r => {
                    console.log(`Error reading SObject '${obj.name}': ${r}`);
                    return undefined;
                });
        });

        const results = await Promise.all(objs);
        const allObjects = results.filter(x => typeof x !== 'undefined');

        const allObjectsWithRowCountPromise = allObjects
            .map(obj => {
                if (!obj.queryable || !obj.replicateable) {
                    return obj;
                }
                return this.readWithCache(
                    "rowcount",
                    `${obj.name}.json`,
                    () => this.conn.getRowCount(obj.name))
                    .then(r => {
                        obj.rowCount = r.rows;
                        return obj;
                    })
                    .catch(r => {
                        console.log(`Error reading row count for SObject '${obj.name}': ${r}`);
                        return obj;
                    });
            });

        const allObjectsWithRowCount = await Promise.all(allObjectsWithRowCountPromise);
        this.SObjects = allObjectsWithRowCount;
    }

    private async readWithCache<T extends object>(folder: string, key: string, func: () => Promise<T>): Promise<T> {
        const path = this.cachePath(folder, key);

        if (this.cacheContains(path)) {
            return this.readCache(path);
        }

        return func().then(v => {
            this.writeCache(path, v);
            return v;
        });
    }

    private cacheContains(path: string) {
        return fs.existsSync(path);
    }

    private readCache(path: string) {
        return JSON.parse(fs.readFileSync(path, 'utf8'));
    }

    private async writeCache(path: string, data: object) {
        mkdirp.sync(p.dirname(path));
        this.asyncWriteFile(path, JSON.stringify(data, undefined, 4));
    }

    private cachePath(folder: string, key: string): string {
        return p.join(this.cacheRoot, folder, key);
    }
}